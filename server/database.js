// Database and GeoServer settings, the two PostgreSQL pools, and the tables / columns created at startup.
import { Pool } from 'pg';

export const PG_HOST = process.env.POSTGRES_HOST;
const PG_PORT = Number(process.env.POSTGRES_PORT || 5432);
const PG_USER = process.env.POSTGRES_USER;
const PG_PASSWORD = process.env.POSTGRES_PASSWORD;
export const SERVICES_DB_NAME = process.env.SERVICES_DB_NAME || 'services_db';
export const REAL_ESTATE_DB_NAME = process.env.REAL_ESTATE_DB_NAME || 'realestate';
// GeoServer يعمل على HTTP، البروكسي سيتولى الاتصال (العنوان من .env فقط: لا عناوين خوادم في المستودع العام)
export const GEOSERVER_TARGET = process.env.GEOSERVER_TARGET;

// =========================================================================
// 🔒 [التحقق من متغيرات البيئة]: التأكد من وجود المتغيرات المطلوبة
// =========================================================================
const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD', 'GEOSERVER_TARGET'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ خطأ: متغيرات البيئة المطلوبة مفقودة:');
    missingEnvVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    // dotenv.config() يقرأ .env فقط (لا .env.local)
    console.error('\n📝 للحل: انسخ .env.example إلى .env في جذر المشروع واملأ القيم المطلوبة.');
    console.error('\n💡 ملف .env محمي من الرفع على GitHub عبر .gitignore');
    process.exit(1);
}

// 1. إعدادات الاتصال بقواعد البيانات المتعددة 

// 🟢 الاتصال الأول: قاعدة بيانات الخدمات (services_db)
export const servicesPool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: SERVICES_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
    max: Number(process.env.PG_POOL_MAX || 25),   // كان الافتراضي 10
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,   // بدل الانتظار للأبد: يفشل الطلب برسالة خطأ
    statement_timeout: 30000,        // استعلام عالق أكثر من 30 ثانية يُلغى
    query_timeout: 35000,
});

servicesPool.on('error', (err) => {
    console.error('⚠️ [Pool Error - services_db] خطأ غير متوقع باتصال خامل، السيرفر سيستمر بالعمل:', err.message);
});

// 🔵 الاتصال الثاني: قاعدة بيانات العقارات (realestate)
export const realestatePool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: REAL_ESTATE_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
    max: Number(process.env.PG_POOL_MAX || 25),
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 8000,
    statement_timeout: 30000,
    query_timeout: 35000,
});

realestatePool.on('error', (err) => {
    console.error('⚠️ [Pool Error - realestate] خطأ غير متوقع باتصال خامل، السيرفر سيستمر بالعمل:', err.message);
});

// فحص الاتصال بقاعدة الخدمات عند بدء التشغيل
servicesPool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ خطأ في الاتصال بقاعدة بيانات الخدمات (services_db):', err.stack);
    }
    console.log('🐘 تم الاتصال بـ PostgreSQL بنجاح: قاعدة الخدمات (services_db)');
    release();
});

// فحص الاتصال بقاعدة العقارات عند بدء التشغيل
realestatePool.connect((err, client, release) => {
    if (err) {
        return console.error('❌ خطأ في الاتصال بقاعدة بيانات العقارات (realestate):', err.stack);
    }
    console.log('🐘 تم الاتصال بـ PostgreSQL بنجاح: قاعدة العقارات (realestate)');
    release();
});



// =========================================================================
// 🆕 ضمان وجود عمود force_logout_flag (تسجيل الخروج الإجباري الحقيقي)
// يُستخدم لإبطال الجلسة المحفوظة في المتصفح فعلياً حتى لو كان المستخدم
// غير متصل وقت الضغط على "تسجيل خروج" من لوحة الإدارة. بدون هذا العمود
// كان تسجيل الخروج الإجباري مجرد إشعار تجميلي لا يمنع الدخول التلقائي
// (autoboot) بجلسة محفوظة قديمة في localStorage.
// =========================================================================
async function ensureSchemaColumns() {
    try {
        await servicesPool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_logout_flag BOOLEAN DEFAULT false`);
        // 🔒 رقم نسخة الجلسة: كل توكن يحمل رقمه، وأي تغيير أمني بالحساب يرفع الرقم فتموت التوكنات القديمة فوراً
        await servicesPool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0`);
        await servicesPool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT`);
        // 🆕 عمود مصدر الحدث (map / quick_search) لتمييز زيارات الخريطة عن زيارات
        // صفحة البحث السريع ضمن إحصائيات المنصة
        await servicesPool.query(`ALTER TABLE public.map_service_stats ADD COLUMN IF NOT EXISTS source_page TEXT`);
        // وجهة الإشعار عند الضغط عليه: 'request:<id>' (يفتح دردشة الطلب) أو مسار صفحة ('/admin/submissions')؛ فارغ = لا وجهة
        await servicesPool.query(`ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link TEXT`);
        console.log('✅ تم التأكد من أعمدة force_logout_flag و whatsapp_number و source_page و notifications.link');
    } catch (err) {
        console.error('⚠️ خطأ أثناء التأكد من مخطط قاعدة البيانات:', err.message);
    }
}

ensureSchemaColumns();

// تأكد بشكل مستقل من حقول الخدمات العقارية؛ لا تجعل ترقية جدول آخر تمنعها.
async function ensureServicePropertyColumns() {
    try {
        await servicesPool.query(`
            ALTER TABLE public.service_all
                ADD COLUMN IF NOT EXISTS price NUMERIC,
                ADD COLUMN IF NOT EXISTS area NUMERIC,
                ADD COLUMN IF NOT EXISTS currency TEXT
        `);
        const result = await servicesPool.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'service_all'
              AND column_name = ANY($1::text[])
        `, [['price', 'area', 'currency']]);
        const present = new Set(result.rows.map(row => row.column_name));
        const missing = ['price', 'area', 'currency'].filter(column => !present.has(column));
        if (missing.length) throw new Error(`أعمدة غير موجودة بعد التهيئة: ${missing.join(', ')}`);
        console.log('✅ service_all يحتوي أعمدة السعر والمساحة والعملة: price, area, currency');
    } catch (err) {
        console.error('❌ تعذر تهيئة أعمدة السعر والمساحة والعملة في service_all:', err.message);
    }
}
ensureServicePropertyColumns();


async function ensureWidgetsSchema() {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.widgets_manual_groups (
                group_key TEXT PRIMARY KEY,
                data JSONB NOT NULL DEFAULT '[]'::jsonb,
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        await servicesPool.query(`ALTER TABLE public.road_barriers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
        await servicesPool.query(`ALTER TABLE public.fuel_stations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()`);
        // 🆕 عمود ترتيب العرض اليدوي لحواجز الطرق ومحطات الوقود
        await servicesPool.query(`ALTER TABLE public.road_barriers ADD COLUMN IF NOT EXISTS display_order INTEGER`);
        await servicesPool.query(`ALTER TABLE public.fuel_stations ADD COLUMN IF NOT EXISTS display_order INTEGER`);
        console.log('✅ تم التأكد من وجود جداول/أعمدة مركز المعلومات الحية');
    } catch (err) {
        console.error('⚠️ خطأ أثناء إنشاء مخطط مركز المعلومات الحية:', err.message);
    }
}
ensureWidgetsSchema();

export function normalizeWhatsappNumber(rawNumber) {
    if (rawNumber === undefined || rawNumber === null) return null;
    const trimmed = String(rawNumber).trim();
    if (!trimmed) return null;

    let digits = trimmed.replace(/\D/g, '');
    if (!digits) return null;
    if (digits.startsWith('00')) digits = digits.substring(2);
    if (digits.startsWith('0') && digits.length === 10) {
        digits = '970' + digits.substring(1);
    } else if (digits.length === 9 && digits.startsWith('5')) {
        digits = '970' + digits;
    }

    return '+' + digits;
}

// =========================================================================
// 🆕 [نظام طلب الخدمة + الدردشة + تسجيل عمليات النجاح]
// جدول service_requests: يمثل كل طلب خدمة من مستخدم إلى مزود خدمة محدد،
// بحالاته المختلفة (pending -> accepted/rejected -> completed).
// جدول service_request_messages: رسائل الدردشة المرتبطة بكل طلب.
// =========================================================================
async function ensureServiceRequestSchema() {
    try {
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.service_requests (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                provider_user_id INTEGER NOT NULL,
                service_layer TEXT NOT NULL,
                feature_id INTEGER,
                provider_name TEXT,
                service_type TEXT,
                status TEXT NOT NULL DEFAULT 'pending',
                contact_type TEXT NOT NULL DEFAULT 'service_request',
                user_confirmed BOOLEAN NOT NULL DEFAULT false,
                provider_confirmed BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        // إضافة عمود contact_type إذا لم يكن موجوداً
        await servicesPool.query(`
            ALTER TABLE public.service_requests 
            ADD COLUMN IF NOT EXISTS contact_type TEXT NOT NULL DEFAULT 'service_request'
        `);
        // تحديث السجلات القديمة التي لا تحتوي على contact_type
        await servicesPool.query(`
            UPDATE public.service_requests 
            SET contact_type = 'service_request' 
            WHERE contact_type IS NULL OR contact_type = ''
        `);
        await servicesPool.query(`
            CREATE TABLE IF NOT EXISTS public.service_request_messages (
                id SERIAL PRIMARY KEY,
                request_id INTEGER NOT NULL REFERENCES public.service_requests(id) ON DELETE CASCADE,
                sender_role TEXT NOT NULL,
                sender_id INTEGER NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        `);
        // جدول التقييمات (كان يُنشأ يدوياً من database/create_service_ratings_table.sql): تقييم واحد لكل طلب
        await servicesPool.query(`
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
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS idx_service_ratings_provider ON public.service_ratings (service_layer, feature_id)`);
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS idx_service_ratings_request ON public.service_ratings (request_id)`);
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS idx_service_ratings_user ON public.service_ratings (user_id)`);
        // فهارس للاستعلامات الشائعة (ملفات المستخدم/المزود، وفحص التكرار عند تسجيل النقرات)
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS service_requests_user_idx ON public.service_requests (user_id, created_at DESC)`);
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS service_requests_provider_idx ON public.service_requests (provider_user_id, status)`);
        await servicesPool.query(`CREATE INDEX IF NOT EXISTS service_requests_feature_idx ON public.service_requests (service_layer, feature_id)`);
        console.log('✅ تم التأكد من وجود جداول طلبات الخدمة والدردشة والتقييمات (service_requests, service_request_messages, service_ratings)');
    } catch (err) {
        console.error('⚠️ خطأ أثناء إنشاء جداول طلبات الخدمة:', err.message);
    }
}
ensureServiceRequestSchema();
