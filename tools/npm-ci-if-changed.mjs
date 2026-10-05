// `npm ci` only when the lock file changed since the last install in this folder (the deploy runner keeps
// node_modules between runs). The fingerprint also covers Node's version and the platform: native modules (bcrypt)
// are built for them. Usage: node tools/npm-ci-if-changed.mjs [folder]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const dir = path.resolve(process.argv[2] ?? '.');
const lock = path.join(dir, 'package-lock.json');
const stamp = path.join(dir, 'node_modules', '.package-lock.sha256');

const fingerprint = crypto
    .createHash('sha256')
    .update(fs.readFileSync(lock))
    .update(`\n${process.version} ${process.platform} ${process.arch}`)
    .digest('hex');
const installed = fs.existsSync(stamp) ? fs.readFileSync(stamp, 'utf8').trim() : null;

if (installed === fingerprint) {
    console.log(`${path.basename(dir)}: package-lock.json unchanged (${fingerprint.slice(0, 12)}), npm ci skipped.`);
} else {
    console.log(`${path.basename(dir)}: ${installed ? 'package-lock.json changed' : 'no recorded install'}, running npm ci.`);
    const result = spawnSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: dir, stdio: 'inherit', shell: process.platform === 'win32' });
    if (result.status !== 0) process.exit(result.status ?? 1);
    // Written only after a successful install: a failed or interrupted one installs again next time.
    fs.writeFileSync(stamp, `${fingerprint}\n`);
}
