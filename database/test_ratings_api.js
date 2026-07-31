const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

async function testRatingsAPI() {
    try {
        // محاكاة API endpoint لجلب التقييمات
        const service_layer = 'carpenter';
        const feature_id = 14;
        
        console.log(`🔍 جلب التقييمات لـ service_layer="${service_layer}" و feature_id=${feature_id}`);
        
        const result = await pool.query(
            `SELECT sr.rating, sr.comment, sr.created_at, u.full_name as user_name
             FROM public.service_ratings sr
             LEFT JOIN public.users u ON sr.user_id = u.user_id
             WHERE sr.service_layer = $1 AND sr.feature_id = $2
             ORDER BY sr.created_at DESC`,
            [service_layer, feature_id]
        );

        const ratings = result.rows;
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
            : 0;

        console.log('📊 النتائج:');
        console.log(`- عدد التقييمات: ${ratings.length}`);
        console.log(`- المتوسط: ${averageRating}`);
        console.log(`- التقييمات:`, ratings);
        
        if (ratings.length > 0) {
            console.log('\n✅ API يعمل بشكل صحيح!');
        } else {
            console.log('\n❌ لا توجد تقييمات لهذه المعايير');
        }
        
    } catch (err) {
        console.error('❌ خطأ:', err.message);
    } finally {
        await pool.end();
    }
}

testRatingsAPI();
