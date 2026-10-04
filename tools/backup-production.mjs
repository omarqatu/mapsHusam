import fs from 'node:fs';
import { backupProduction } from '../lib/production-backup.js';

const [mode, deployPath, backupRoot, release = 'manual'] = process.argv.slice(2);
try {
    if (!['preflight', 'backup'].includes(mode) || !deployPath || !backupRoot) {
        throw new Error('Usage: node tools/backup-production.mjs preflight|backup DeployPath BackupRoot Release');
    }
    const input = fs.readFileSync(0, 'utf8').replace(/^\uFEFF/, '').trim();
    const serviceEnv = input ? JSON.parse(input) : {};
    await backupProduction({ deployPath, backupRoot, release, serviceEnv, preflight: mode === 'preflight' });
} catch (error) {
    console.error(error.message);
    process.exitCode = 1;
}
