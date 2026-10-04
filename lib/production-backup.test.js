import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { productionConfig, backupProduction } from './production-backup.js';

const env = {
    POSTGRES_HOST: '127.0.0.1', POSTGRES_USER: 'dev', POSTGRES_PASSWORD: 'dev-only',
    GEOSERVER_TARGET: 'http://127.0.0.1:8080/geoserver', JWT_SECRET: 'a'.repeat(48),
};

test('backup uses the same credentials and upload path as the service; never reads the repo env', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psm-config-'));
    try {
        fs.writeFileSync(path.join(root, '.env'), 'POSTGRES_HOST=file-host\nUPLOADS_DIR=uploads/custom\n');
        const config = productionConfig(root, env);
        assert.equal(config.env.POSTGRES_HOST, env.POSTGRES_HOST);
        assert.equal(config.uploads, path.join(root, 'uploads', 'custom'));
        assert.deepEqual(config.databases, ['services_db', 'realestate']);
        assert.equal(productionConfig(root, { ...env, UPLOADS_DIR: '../data' }).uploads, path.resolve(root, '../data'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('missing credentials, placeholder secrets and unprotected uploads block the deployment', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psm-config-'));
    try {
        assert.throws(() => productionConfig(root, {}), /POSTGRES_HOST/);
        assert.throws(() => productionConfig(root, { ...env, JWT_SECRET: 'your_secret_key'.repeat(4) }), /JWT_SECRET/);
        assert.throws(() => productionConfig(root, { ...env, SERVE_REACT_APP: 'off' }), /SERVE_REACT_APP/);
        for (const uploads of ['.', 'web/pictures', 'pictures']) {
            assert.throws(() => productionConfig(root, { ...env, UPLOADS_DIR: uploads }), /UPLOADS_DIR/);
        }
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

// Exercise failure and success of the backup contract without depending on a running database in CI.
test('only a complete pair of verified dumps and a photo snapshot gets a manifest', { skip: process.platform === 'win32' }, async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'psm-backup-'));
    const deploy = path.join(root, 'site');
    const backupRoot = path.join(root, 'backups');
    const bin = path.join(root, 'bin');
    fs.mkdirSync(path.join(deploy, 'uploads'), { recursive: true });
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(deploy, 'uploads', 'photo.png'), 'example photo');
    const makeTool = (name, code) => fs.writeFileSync(path.join(bin, name), `#!${process.execPath}\n${code}`, { mode: 0o700 });
    makeTool('pg_dump', `if (process.argv.includes('--version')) process.exit(0);
        const fs = require('fs'); const args = process.argv;
        fs.writeFileSync(args[args.indexOf('--file') + 1], 'example dump');`);
    makeTool('pg_restore', `console.log('TABLE public.test');`);
    const options = { deployPath: deploy, backupRoot, release: 'test-sha', serviceEnv: { ...env, PG_BIN: bin } };
    try {
        await backupProduction({ ...options, preflight: true });
        assert.deepEqual(fs.readdirSync(backupRoot), []);
        const folder = await backupProduction(options);
        const manifest = JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json')));
        assert.equal(manifest.complete, true);
        assert.equal(manifest.files.length, 2);
        assert.equal(manifest.files[0].sha256.length, 64);
        assert.equal(fs.readFileSync(path.join(folder, 'uploads', 'photo.png'), 'utf8'), 'example photo');
        makeTool('pg_dump', `if (process.argv.includes('--version')) process.exit(0); process.exit(1);`);
        await assert.rejects(backupProduction(options), /pg_dump failed/);
        const failed = fs.readdirSync(backupRoot).map(name => path.join(backupRoot, name)).find(name => fs.existsSync(path.join(name, 'FAILED')));
        assert.ok(failed);
        assert.equal(fs.existsSync(path.join(failed, 'manifest.json')), false);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
