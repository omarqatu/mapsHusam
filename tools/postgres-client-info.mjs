import fs from 'node:fs';
import path from 'node:path';
import { Pool } from 'pg';
import { productionConfig } from '../lib/production-backup.js';

const [mode, deployPath, bin] = process.argv.slice(2);
try {
    if (mode === 'set') {
        const filename = path.join(deployPath, '.env');
        let text = fs.readFileSync(filename, 'utf8');
        text = /^PG_BIN=.*$/m.test(text) ? text.replace(/^PG_BIN=.*$/m, `PG_BIN=${bin}`) : text + `\nPG_BIN=${bin}\n`;
        fs.writeFileSync(filename, text);
        console.log('PostgreSQL client path configured.');
    } else if (mode === 'info') {
        const config = productionConfig(deployPath);
        const pool = new Pool({ host: config.env.POSTGRES_HOST, port: Number(config.env.POSTGRES_PORT || 5432),
            user: config.env.POSTGRES_USER, password: config.env.POSTGRES_PASSWORD, database: config.databases[0],
            connectionTimeoutMillis: 10000 });
        let major;
        try {
            const result = await pool.query("SELECT current_setting('server_version_num')::integer AS version");
            major = Math.floor(result.rows[0].version / 10000);
        } finally { await pool.end(); }
        const estate = new Pool({ host: config.env.POSTGRES_HOST, port: Number(config.env.POSTGRES_PORT || 5432),
            user: config.env.POSTGRES_USER, password: config.env.POSTGRES_PASSWORD, database: config.databases[1],
            connectionTimeoutMillis: 10000 });
        try { await estate.query('SELECT 1'); } finally { await estate.end(); }
        // Published Windows x64 archive links from EDB, linked by postgresql.org/download/windows.
        const archiveIds = { 14: 1260637, 15: 1260630, 16: 1260623, 17: 1260616, 18: 1260609 };
        if (!archiveIds[major]) throw new Error(`No configured supported PostgreSQL client archive for database major ${major}.`);
        console.log(JSON.stringify({ major, url: `https://sbp.enterprisedb.com/getfile.jsp?fileid=${archiveIds[major]}` }));
    } else throw new Error('Expected info or set mode.');
} catch (error) {
    // Do not print connection/server messages, which may contain private host or account details.
    console.error(mode === 'info' ? 'Could not validate both production databases or select a supported client version.' : 'Could not configure PostgreSQL client path.');
    process.exitCode = 1;
}
