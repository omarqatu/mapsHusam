const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

async function checkData() {
    try {
        console.log('🔍 فحص آخر 5 تقييمات:\n');
        const ratingsResult = await pool.query(`
            SELECT sr.id, sr.request_id, sr.user_id, sr.provider_user_id, 
                   sr.service_layer, sr.feature_id, sr.rating, sr.comment, sr.created_at
            FROM public.service_ratings sr
            ORDER BY sr.created_at DESC
            LIMIT 5
        `);
        
        if (ratingsResult.rows.length > 0) {
            ratingsResult.rows.forEach(r => {
                console.log(`ID: ${r.id}`);
                console.log(`Request ID: ${r.request_id}`);
                console.log(`Service Layer: ${r.service_layer}`);
                console.log(`Feature ID: ${r.feature_id}`);
                console.log(`Rating: ${r.rating}`);
                console.log(`Comment: ${r.comment}`);
                console.log('---');
            });
        } else {
            console.log('❌ لا توجد تقييمات في الجدول');
        }
        
        console.log('\n🔍 فحص آخر طلب مكتمل:\n');
        const requestResult = await pool.query(`
            SELECT id, user_id, provider_user_id, service_layer, feature_id, status
            FROM public.service_requests
            WHERE status = 'completed'
            ORDER BY updated_at DESC
            LIMIT 3
        `);
        
        if (requestResult.rows.length > 0) {
            requestResult.rows.forEach(r => {
                console.log(`Request ID: ${r.id}`);
                console.log(`Service Layer: ${r.service_layer}`);
                console.log(`Feature ID: ${r.feature_id}`);
                console.log(`Status: ${r.status}`);
                console.log('---');
            });
        } else {
            console.log('❌ لا توجد طلبات مكتملة');
        }
        
    } catch (err) {
        console.error('❌ خطأ:', err.message);
    } finally {
        await pool.end();
    }
}

checkData();
