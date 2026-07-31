/**
 * سكربت إنشاء جدول التقييمات والتعليقات في قاعدة البيانات
 * التشغيل: node database/create_ratings_table.js
 */

const { Pool } = require('pg');

// إعدادات الاتصال بقاعدة البيانات
const PG_HOST = process.env.POSTGRES_HOST || 'localhost';
const PG_PORT = Number(process.env.POSTGRES_PORT || 5432);
const PG_USER = process.env.POSTGRES_USER || '';
const PG_PASSWORD = process.env.POSTGRES_PASSWORD || '';
const SERVICES_DB_NAME = process.env.SERVICES_DB_NAME || 'services_db';

const pool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: SERVICES_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
});

async function createRatingsTable() {
    const client = await pool.connect();
    
    try {
        console.log('🔗 جاري الاتصال بقاعدة البيانات...');
        
        await client.query('BEGIN');
        
        console.log('📊 جاري إنشاء جدول service_ratings...');
        
        // إنشاء الجدول
        await client.query(`
            CREATE TABLE IF NOT EXISTS public.service_ratings (
                id SERIAL PRIMARY KEY,
                request_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                provider_user_id INTEGER NOT NULL,
                service_layer VARCHAR(100) NOT NULL,
                feature_id INTEGER NOT NULL,
                rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
                comment TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                
                CONSTRAINT unique_rating_per_request UNIQUE (request_id, user_id),
                CONSTRAINT fk_request FOREIGN KEY (request_id) 
                    REFERENCES public.service_requests(id) ON DELETE CASCADE,
                CONSTRAINT fk_user FOREIGN KEY (user_id) 
                    REFERENCES public.users(user_id) ON DELETE CASCADE,
                CONSTRAINT fk_provider FOREIGN KEY (provider_user_id) 
                    REFERENCES public.users(user_id) ON DELETE CASCADE
            );
        `);
        
        console.log('✅ تم إنشاء الجدول بنجاح');
        
        // إنشاء الفهارس
        console.log('📇 جاري إنشاء الفهارس...');
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_provider 
                ON public.service_ratings(service_layer, feature_id);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_request 
                ON public.service_ratings(request_id);
        `);
        
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_user 
                ON public.service_ratings(user_id);
        `);
        
        console.log('✅ تم إنشاء الفهارس بنجاح');
        
        // إضافة التعليقات على الجدول
        console.log('💬 جاري إضافة التعليقات...');
        
        await client.query(`
            COMMENT ON TABLE public.service_ratings IS 'جدول تخزين تقييمات وتعليقات المستخدمين على مزودي الخدمات بعد اكتمال الاتفاق';
        `);
        
        await client.query(`
            COMMENT ON COLUMN public.service_ratings.rating IS 'التقييم من 1 إلى 5 نجوم';
        `);
        
        await client.query(`
            COMMENT ON COLUMN public.service_ratings.comment IS 'التعليق النصي الاختياري على الخدمة';
        `);
        
        console.log('✅ تم إضافة التعليقات بنجاح');
        
        await client.query('COMMIT');
        
        console.log('🎉 تم إنشاء جدول التقييمات بنجاح!');
        console.log('📋 تفاصيل الجدول:');
        console.log('   - id: المفتاح الأساسي (SERIAL)');
        console.log('   - request_id: معرف طلب الخدمة (INTEGER)');
        console.log('   - user_id: معرف المستخدم الذي قام بالتقييم (INTEGER)');
        console.log('   - provider_user_id: معرف مزود الخدمة (INTEGER)');
        console.log('   - service_layer: اسم طبقة الخدمة (VARCHAR 100)');
        console.log('   - feature_id: معرف المعلم في الطبقة (INTEGER)');
        console.log('   - rating: التقييم من 1 إلى 5 (INTEGER)');
        console.log('   - comment: التعليق النصي (TEXT)');
        console.log('   - created_at: تاريخ الإنشاء (TIMESTAMP)');
        
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء إنشاء الجدول:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

// تشغيل السكربت
createRatingsTable();
