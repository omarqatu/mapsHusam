import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

export function productionConfig(deployPath, serviceEnv = {}) {
    const envPath = path.join(deployPath, '.env');
    const fileEnv = fs.existsSync(envPath) ? dotenv.parse(fs.readFileSync(envPath)) : {};
    // Same precedence as Node in the Windows service: service/machine variables override .env.
    const env = { ...fileEnv, ...serviceEnv };
    for (const key of ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'GEOSERVER_TARGET', 'JWT_SECRET']) {
        if (!env[key]) throw new Error(`Production configuration is missing ${key}.`);
    }
    if (env.JWT_SECRET.length < 32 || /change_this|your_|secret_key|changeme/i.test(env.JWT_SECRET)) {
        throw new Error('Production JWT_SECRET must be a non-placeholder secret of at least 32 characters.');
    }
    if (env.SERVE_REACT_APP?.toLowerCase() === 'off') throw new Error('Production SERVE_REACT_APP must not be off.');
    const uploads = path.resolve(deployPath, env.UPLOADS_DIR || 'uploads');
    const relative = path.relative(deployPath, uploads);
    if (relative !== 'uploads' && !relative.startsWith(`uploads${path.sep}`)
        && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)) {
        throw new Error('UPLOADS_DIR must be inside the protected uploads directory or outside DeployPath.');
    }
    return {
        env,
        uploads,
        databases: [env.SERVICES_DB_NAME || 'services_db', env.REAL_ESTATE_DB_NAME || 'realestate'],
    };
}

function runTool(executable, args, env) {
    const result = spawnSync(executable, args, { env, encoding: 'utf8', timeout: 30 * 60 * 1000, windowsHide: true });
    // Never forward tool stderr: connection strings and server messages can contain private configuration.
    if (result.error || result.status !== 0) throw new Error(`${path.basename(executable)} failed (exit ${result.status ?? 'unavailable'}).`);
    return result.stdout;
}

export function postgresTools(env = process.env) {
    const dirs = [];
    if (env.PG_BIN) dirs.push(env.PG_BIN);
    if (process.platform === 'win32') {
        const root = path.join(env.ProgramFiles || 'C:\\Program Files', 'PostgreSQL');
        if (fs.existsSync(root)) {
            dirs.push(...fs.readdirSync(root).sort((a, b) => Number(b) - Number(a)).map(v => path.join(root, v, 'bin')));
        }
    }
    dirs.push(...(env.PATH || env.Path || '').split(path.delimiter));
    const suffix = process.platform === 'win32' ? '.exe' : '';
    for (const dir of dirs) {
        const dump = path.join(dir, `pg_dump${suffix}`);
        const restore = path.join(dir, `pg_restore${suffix}`);
        if (fs.existsSync(dump) && fs.existsSync(restore)) {
            runTool(dump, ['--version'], process.env);
            runTool(restore, ['--version'], process.env);
            return { dump, restore };
        }
    }
    throw new Error('PostgreSQL pg_dump and pg_restore are required. Install matching PostgreSQL client tools or configure PG_BIN.');
}

export async function backupProduction({ deployPath, backupRoot, release, serviceEnv = {}, preflight = false }) {
    const config = productionConfig(deployPath, serviceEnv);
    const tools = postgresTools({ ...process.env, ...config.env });
    const relativeBackup = path.relative(deployPath, backupRoot);
    if (!relativeBackup || (!relativeBackup.startsWith(`..${path.sep}`) && relativeBackup !== '..' && !path.isAbsolute(relativeBackup))) {
        throw new Error('BackupRoot must be outside DeployPath.');
    }
    // Check the destination is writable before the live service is stopped.
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    const probe = path.join(backupRoot, `.write-check-${crypto.randomUUID()}`);
    fs.writeFileSync(probe, '', { flag: 'wx', mode: 0o600 });
    fs.unlinkSync(probe);
    if (preflight) return;

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folder = path.join(backupRoot, `${stamp}-${crypto.randomUUID().slice(0, 8)}`);
    fs.mkdirSync(folder, { mode: 0o700 });
    const pgEnv = {
        ...process.env,
        PGHOST: config.env.POSTGRES_HOST,
        PGPORT: config.env.POSTGRES_PORT || '5432',
        PGUSER: config.env.POSTGRES_USER,
        PGPASSWORD: config.env.POSTGRES_PASSWORD,
        PGCONNECT_TIMEOUT: '15',
        PGOPTIONS: '-c statement_timeout=0',
    };
    const files = [];
    try {
        for (const [index, database] of config.databases.entries()) {
            const name = index === 0 ? 'services.dump' : 'realestate.dump';
            const filename = path.join(folder, name);
            runTool(tools.dump, ['--no-password', '--format=custom', '--file', filename, '--dbname', database], pgEnv);
            const toc = runTool(tools.restore, ['--list', filename], pgEnv);
            if (!toc.includes('TABLE')) throw new Error(`Backup ${name} has no tables.`);
            const bytes = fs.statSync(filename).size;
            const hash = crypto.createHash('sha256');
            for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
            files.push({ file: name, database, bytes, sha256: hash.digest('hex') });
        }
        const uploadsExist = fs.existsSync(config.uploads);
        if (uploadsExist) fs.cpSync(config.uploads, path.join(folder, 'uploads'), { recursive: true, dereference: true });
        fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({
            complete: true, createdAt: new Date().toISOString(), release, files,
            uploadsSource: config.uploads, uploadsIncluded: uploadsExist,
        }, null, 2), { mode: 0o600 });
        console.log(`Verified database and uploads backup: ${folder}`);
        return folder;
    } catch (error) {
        // Retain partial files for diagnosis, but never label this snapshot complete.
        fs.writeFileSync(path.join(folder, 'FAILED'), 'Backup incomplete; do not use as a complete snapshot.\n', { mode: 0o600 });
        throw error;
    }
}
