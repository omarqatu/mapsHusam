const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

async function checkTable() {
    try {
        const result = await pool.query(`
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'service_ratings'
            ORDER BY ordinal_position
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ جدول service_ratings موجود بنجاح!\n');
            console.log('📊 تفاصيل الأعمدة:\n');
            result.rows.forEach(col => {
                console.log(`   • ${col.column_name}`);
                console.log(`     النوع: ${col.data_type}`);
                console.log(`     قابل للقيم الفارغة: ${col.is_nullable}`);
                if (col.column_default) {
                    console.log(`     القيمة الافتراضية: ${col.column_default}`);
                }
                console.log('');
            });
        } else {
            console.log('❌ الجدول غير موجود');
        }
    } catch (err) {
        console.error('❌ خطأ:', err.message);
    } finally {
        await pool.end();
    }
}

checkTable();
