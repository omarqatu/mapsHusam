const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

pool.query('SELECT table_name FROM information_schema.tables WHERE table_name = $1', ['service_ratings'])
    .then(res => {
        if (res.rows.length > 0) {
            console.log('✅ الجدول موجود بنجاح!');
            console.log('📋 اسم الجدول:', res.rows[0].table_name);
            
            // عرض أعمدة الجدول
            return pool.query(`
                SELECT column_name, data_type, is_nullable, column_default
                FROM information_schema.columns
                WHERE table_name = 'service_ratings'
                ORDER BY ordinal_position
            `);
        } else {
            console.log('❌ الجدول غير موجود');
            pool.end();
        }
    })
    .then(res => {
        if (res && res.rows.length > 0) {
            console.log('\n📊 أعمدة الجدول:');
            res.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
            });
        }
        pool.end();
    })
    .catch(err => {
        console.error('❌ خطأ:', err.message);
        pool.end();
    });
