const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.POSTGRES_USER || '',
    host: process.env.POSTGRES_HOST || 'localhost',
    database: process.env.SERVICES_DB_NAME || 'services_db',
    password: process.env.POSTGRES_PASSWORD || '',
    port: Number(process.env.POSTGRES_PORT || 5432)
});

async function createTable() {
    try {
        console.log('جاري إنشاء جدول service_ratings...');
        
        await pool.query(`
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
                CONSTRAINT fk_request FOREIGN KEY (request_id) REFERENCES public.service_requests(id) ON DELETE CASCADE,
                CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE,
                CONSTRAINT fk_provider FOREIGN KEY (provider_user_id) REFERENCES public.users(user_id) ON DELETE CASCADE
            )
        `);
        
        console.log('✅ تم إنشاء الجدول بنجاح');
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_provider 
            ON public.service_ratings(service_layer, feature_id)
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_request 
            ON public.service_ratings(request_id)
        `);
        
        await pool.query(`
            CREATE INDEX IF NOT EXISTS idx_service_ratings_user 
            ON public.service_ratings(user_id)
        `);
        
        console.log('✅ تم إنشاء الفهارس بنجاح');
        
    } catch (err) {
        console.error('❌ خطأ:', err.message);
    } finally {
        await pool.end();
    }
}

createTable();
