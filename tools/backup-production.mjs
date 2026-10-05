import fs from 'node:fs';
import { backupProduction, prepareSnapshot } from '../lib/production-backup.js';

// preflight: configuration and tools only. prepare: a new snapshot folder (printed as JSON) for the pictures copy.
// backup: the databases into that folder (or a new one, pictures included), with the service stopped.
const [mode, deployPath, backupRoot, release = 'manual', folder] = process.argv.slice(2);
try {
    if (!['preflight', 'prepare', 'backup'].includes(mode) || !deployPath || !backupRoot) {
        throw new Error('Usage: node tools/backup-production.mjs preflight|prepare|backup DeployPath BackupRoot Release [SnapshotFolder]');
    }
    const input = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    const serviceEnv = input ? JSON.parse(input) : {};
    if (mode === 'prepare') console.log(JSON.stringify(prepareSnapshot({ deployPath, backupRoot, serviceEnv })));
    else await backupProduction({ deployPath, backupRoot, release, serviceEnv, preflight: mode === 'preflight', folder: folder || undefined });
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
