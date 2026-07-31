const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

async function checkUsersTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'users'
            ORDER BY ordinal_position
        `);
        
        console.log('📊 أعمدة جدول users:\n');
        result.rows.forEach(col => {
            console.log(`   • ${col.column_name}: ${col.data_type}`);
        });
    } catch (err) {
        console.error('❌ خطأ:', err.message);
    } finally {
        await pool.end();
    }
}

checkUsersTable();
