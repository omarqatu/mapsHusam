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

function checkBackupRoot(deployPath, backupRoot) {
    const relativeBackup = path.relative(deployPath, backupRoot);
    if (!relativeBackup || (!relativeBackup.startsWith(`..${path.sep}`) && relativeBackup !== '..' && !path.isAbsolute(relativeBackup))) {
        throw new Error('BackupRoot must be outside DeployPath.');
    }
    // Check the destination is writable before the live service is stopped.
    fs.mkdirSync(backupRoot, { recursive: true, mode: 0o700 });
    const probe = path.join(backupRoot, `.write-check-${crypto.randomUUID()}`);
    fs.writeFileSync(probe, '', { flag: 'wx', mode: 0o600 });
    fs.unlinkSync(probe);
}

const newSnapshotFolder = (backupRoot) => {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const folder = path.join(backupRoot, `${stamp}-${crypto.randomUUID().slice(0, 8)}`);
    fs.mkdirSync(folder, { mode: 0o700 });
    return folder;
};

/** Files and bytes under a folder (printed, so the log shows how large the picture snapshot is). */
function folderSize(dir) {
    let files = 0;
    let bytes = 0;
    if (!fs.existsSync(dir)) return { files, bytes };
    for (const entry of fs.readdirSync(dir, { withFileTypes: true, recursive: true })) {
        if (!entry.isFile()) continue;
        files += 1;
        bytes += fs.statSync(path.join(entry.parentPath, entry.name)).size;
    }
    return { files, bytes };
}

const seconds = (since) => `${((Date.now() - since) / 1000).toFixed(1)}s`;

/**
 * Before the service stops: the snapshot folder, and where the pictures live. The deploy script copies the pictures
 * into it while the site still runs, then again (only what changed) once it is stopped — a complete copy in every
 * snapshot, but the stopped site only waits for the difference.
 */
export function prepareSnapshot({ deployPath, backupRoot, serviceEnv = {} }) {
    const config = productionConfig(deployPath, serviceEnv);
    checkBackupRoot(deployPath, backupRoot);
    return { folder: newSnapshotFolder(backupRoot), uploads: config.uploads, pic: path.join(deployPath, 'pic') };
}

/**
 * The snapshot, taken with the service stopped. `folder` (from prepareSnapshot) already holds the pictures, copied by
 * the deploy script; without it the pictures are copied here.
 */
export async function backupProduction({ deployPath, backupRoot, release, serviceEnv = {}, preflight = false, folder: prepared }) {
    const config = productionConfig(deployPath, serviceEnv);
    const tools = postgresTools({ ...process.env, ...config.env });
    checkBackupRoot(deployPath, backupRoot);
    if (preflight) return;

    const folder = prepared ?? newSnapshotFolder(backupRoot);
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
            const started = Date.now();
            const name = index === 0 ? 'services.dump' : 'realestate.dump';
            const filename = path.join(folder, name);
            runTool(tools.dump, ['--no-password', '--format=custom', '--file', filename, '--dbname', database], pgEnv);
            const toc = runTool(tools.restore, ['--list', filename], pgEnv);
            if (!toc.includes('TABLE')) throw new Error(`Backup ${name} has no tables.`);
            const bytes = fs.statSync(filename).size;
            const hash = crypto.createHash('sha256');
            for await (const chunk of fs.createReadStream(filename)) hash.update(chunk);
            files.push({ file: name, database, bytes, sha256: hash.digest('hex') });
            console.log(`[time] dump ${name}: ${seconds(started)} (${(bytes / 1048576).toFixed(1)} MB)`);
        }
        const legacyPhotos = path.join(deployPath, 'pic');
        const uploadsExist = fs.existsSync(config.uploads);
        const legacyPhotosExist = fs.existsSync(legacyPhotos);
        if (!prepared) {
            const started = Date.now();
            if (uploadsExist) fs.cpSync(config.uploads, path.join(folder, 'uploads'), { recursive: true, dereference: true });
            if (legacyPhotosExist) fs.cpSync(legacyPhotos, path.join(folder, 'pic'), { recursive: true, dereference: true });
            console.log(`[time] copy pictures: ${seconds(started)}`);
        }
        // Pictures copied by the deploy script must be there; a missing copy is not a complete snapshot.
        const pictures = { uploads: folderSize(path.join(folder, 'uploads')), pic: folderSize(path.join(folder, 'pic')) };
        if (uploadsExist && pictures.uploads.files < folderSize(config.uploads).files) throw new Error('The uploads snapshot is incomplete.');
        if (legacyPhotosExist && pictures.pic.files < folderSize(legacyPhotos).files) throw new Error('The pic snapshot is incomplete.');
        console.log(`Pictures in the snapshot: uploads ${pictures.uploads.files} files / ${(pictures.uploads.bytes / 1048576).toFixed(1)} MB, `
            + `pic ${pictures.pic.files} files / ${(pictures.pic.bytes / 1048576).toFixed(1)} MB`);
        fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify({
            complete: true, createdAt: new Date().toISOString(), release, files, pictures,
            uploadsSource: config.uploads, uploadsIncluded: uploadsExist, legacyPhotosIncluded: legacyPhotosExist,
        }, null, 2), { mode: 0o600 });
        console.log(`Verified database and uploads backup: ${folder}`);
        return folder;
    } catch (error) {
        // Retain partial files for diagnosis, but never label this snapshot complete.
        fs.writeFileSync(path.join(folder, 'FAILED'), 'Backup incomplete; do not use as a complete snapshot.\n', { mode: 0o600 });
        throw error;
    }
}
