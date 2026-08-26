/**
 * server.js 
 */

// تحميل متغيرات البيئة من ملف .env.local
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { fileURLToPath } from 'url';
import { Pool } from 'pg';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

// تعريف __dirname لـ ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BCRYPT_SALT_ROUNDS = 10;
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;
const REAL_ESTATE_LAYERS = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];

// =========================================================================
// 🆕 [ترحيل آمن لكلمات المرور]: الحسابات القديمة محفوظة بكلمة مرور نصية
// صريحة بقاعدة البيانات (قبل هذا التعديل). هذه الدالة تتحقق من كلمة المرور
// بطريقتين: إذا كانت القيمة المخزّنة تبدو كـ bcrypt hash نستخدم bcrypt.compare
// العادي، وإلا (حساب قديم لم يُحدَّث بعد) نقارنها نصياً كما كان يعمل النظام
// سابقاً فقط لمرة الدخول هذه، ثم نُعيد تشفيرها فوراً بـ bcrypt حتى لا تبقى
// نصاً صريحاً بعد أول تسجيل دخول ناجح لهذا المستخدم.
// =========================================================================
async function verifyPasswordWithMigration(plainPassword, storedValue) {
    if (!storedValue) return { valid: false, needsRehash: false };

    if (BCRYPT_HASH_REGEX.test(storedValue)) {
        const valid = await bcrypt.compare(plainPassword, storedValue);
        return { valid, needsRehash: false };
    }

    // حساب قديم لم يُهاجَر بعد: مقارنة نصية كما كان النظام يعمل سابقاً
    const valid = plainPassword === storedValue;
    return { valid, needsRehash: valid }; // إذا صحّت، نعيد تشفيرها فوراً بعد هذا الاستدعاء
}

// =========================================================================
// 🆕 [تشديد أمني]: قائمة الدومينات المسموح لها بالوصول عبر CORS. اضبط متغير
// البيئة ALLOWED_ORIGINS بدومين واحد أو أكثر مفصولين بفاصلة (مثلاً
// "https://palestine-services-map.com,https://www.palestine-services-map.com").
// إذا لم يُضبط، نسمح بأي دومين مؤقتاً (نفس السلوك القديم) مع تحذير بالكونسول،
// لتفادي كسر الموقع فوراً، لكن يُنصح بشدة بضبط هذا المتغير بالإنتاج.
// =========================================================================
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()).filter(Boolean)
    : null;

if (!ALLOWED_ORIGINS) {
    console.warn('⚠️ [أمان] متغير البيئة ALLOWED_ORIGINS غير مضبوط - سيتم السماح لأي دومين بالوصول عبر CORS مؤقتاً. اضبطه بالإنتاج لتقييد الوصول.');
}

function corsOriginCheck(origin, callback) {
    // طلبات بدون origin (مثل curl أو تطبيقات موبايل أو نفس السيرفر) نسمح بها دائماً
    if (!origin || !ALLOWED_ORIGINS) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('غير مسموح بالوصول من هذا الدومين (CORS)'));
}

const app = express();
const server = http.createServer(app);

// 🔒 Security Middleware
if (process.env.ENABLE_HELMET !== 'false') {
    app.use(helmet({
        contentSecurityPolicy: false, // تعطيل CSP مؤقتاً للتوافق مع GeoServer
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));
}

// 🛡️ XSS Protection Middleware (معطل مؤقتاً لتجنب مشاكل البيانات)
// app.use((req, res, next) => {
//     // تنظيف البيانات من XSS
//     const sanitize = (obj) => {
//         if (typeof obj === 'string') {
//             return obj.replace(/</g, '&lt;').replace(/>/g, '&gt;');
//         }
//         if (Array.isArray(obj)) {
//             return obj.map(sanitize);
//         }
//         if (obj !== null && typeof obj === 'object') {
//             const sanitized = {};
//             for (const key in obj) {
//                 sanitized[key] = sanitize(obj[key]);
//             }
//             return sanitized;
//         }
//         return obj;
//     };
//
//     if (req.body) {
//         req.body = sanitize(req.body);
//     }
//     if (req.query) {
//         req.query = sanitize(req.query);
//     }
//     if (req.params) {
//         req.params = sanitize(req.params);
//     }
//     next();
// });

// 🚦 Rate Limiting
const apiLimiter = rateLimit({
    windowMs: parseInt(process.env.API_RATE_WINDOW_MS) || 15 * 60 * 1000, // 15 دقيقة افتراضياً
    max: parseInt(process.env.API_RATE_LIMIT) || 1000, // زيادة الحد إلى 1000 طلب
    message: { success: false, error: 'طلبات كثيرة جداً، يرجى المحاولة لاحقاً' },
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: parseInt(process.env.AUTH_RATE_LIMIT) || 10, // زيادة الحد إلى 10
    message: { success: false, error: 'محاولات تسجيل دخول كثيرة، يرجى المحاولة لاحقاً' }
});

// تعطيل Rate Limiting العام لتجنب منع الطلبات المهمة
// سيتم تطبيقه فقط على endpoints حساسة (تسجيل الدخول، التسجيل)
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
    // لا نطبق على جميع /api/ لتجنب منع الطلبات المهمة
    // app.use('/api/', apiLimiter);
}

const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS || '*',
        methods: ['GET', 'POST']
    }
});

app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const PG_HOST = process.env.POSTGRES_HOST;
const PG_PORT = Number(process.env.POSTGRES_PORT || 5432);
const PG_USER = process.env.POSTGRES_USER;
const PG_PASSWORD = process.env.POSTGRES_PASSWORD;
const SERVICES_DB_NAME = process.env.SERVICES_DB_NAME || 'services_db';
const REAL_ESTATE_DB_NAME = process.env.REAL_ESTATE_DB_NAME || 'realestate';
// GeoServer يعمل على HTTP، البروكسي سيتولى الاتصال
const GEOSERVER_TARGET = process.env.GEOSERVER_TARGET || 'http://194.163.174.162:8080/geoserver';

// =========================================================================
// 🔒 [التحقق من متغيرات البيئة]: التأكد من وجود المتغيرات المطلوبة
// =========================================================================
const requiredEnvVars = ['POSTGRES_HOST', 'POSTGRES_USER', 'POSTGRES_PASSWORD'];
const missingEnvVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingEnvVars.length > 0) {
    console.error('❌ خطأ: متغيرات البيئة المطلوبة مفقودة:');
    missingEnvVars.forEach(varName => {
        console.error(`   - ${varName}`);
    });
    console.error('\n📝 للحل، قم بإنشاء ملف .env.local في جذر المشروع بالمحتوى التالي:');
    console.error('   POSTGRES_HOST=144.91.84.168');
    console.error('   POSTGRES_PORT=5432');
    console.error('   POSTGRES_USER=Husam');
    console.error('   POSTGRES_PASSWORD=Husam');
    console.error('   SERVICES_DB_NAME=services_db');
    console.error('   REAL_ESTATE_DB_NAME=realestate');
    console.error('   GEOSERVER_TARGET=http://194.163.174.162:8080/geoserver');
    console.error('   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173');
    console.error('\n💡 ملف .env.local محمي من الرفع على GitHub عبر .gitignore');
    process.exit(1);
}

// 1. إعدادات الاتصال بقواعد البيانات المتعددة 

// 🟢 الاتصال الأول: قاعدة بيانات الخدمات (services_db)
const servicesPool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: SERVICES_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
});

// 🔵 الاتصال الثاني: قاعدة بيانات العقارات (realestate)
const realestatePool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: REAL_ESTATE_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
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
        await servicesPool.query(`ALTER TABLE public.users ADD COLUMN IF NOT EXISTS whatsapp_number TEXT`);
        console.log('✅ تم التأكد من وجود أعمدة force_logout_flag و whatsapp_number في جدول users');
    } catch (err) {
        console.error('⚠️ خطأ أثناء التأكد من مخطط قاعدة البيانات:', err.message);
    }
}
ensureSchemaColumns();

function normalizeWhatsappNumber(rawNumber) {
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
                user_confirmed BOOLEAN NOT NULL DEFAULT false,
                provider_confirmed BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
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
        console.log('✅ تم التأكد من وجود جداول طلبات الخدمة (service_requests) والدردشة (service_request_messages)');
    } catch (err) {
        console.error('⚠️ خطأ أثناء إنشاء جداول طلبات الخدمة:', err.message);
    }
}
ensureServiceRequestSchema();

// دالة مسارة لاختيار الاتصال المناسب حسب الطبقة
function getPoolForLayer(layerName) {
    if (REAL_ESTATE_LAYERS.includes(layerName)) {
        return realestatePool;
    }
    return servicesPool;
}

// 2. الميدل وير (Middlewares)
app.use(cors({
    origin: corsOriginCheck,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['application/xml', 'text/xml', 'application/vnd.ogc.wfs-transaction+xml'], limit: '10mb' }));

// ميدل وير لمصادفة أخطاء JSON: يرجع استجابة JSON بدلاً من صفحة HTML إذا كان جسم الطلب غير صالح
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ خطأ في تحليل JSON:', err.message);
        return res.status(400).json({ error: 'تنسيق JSON غير صالح في جسم الطلب.' });
    }
    next(err);
});

// [إجراء أمني 1]: قائمة بيضاء للطبقات المسموح بالوصول إليها والتعديل عليها (تشمل كافة الخدمات والعقارات الفعالة)
const ALLOWED_LAYERS = [
    // --- طبقات الخدمات التفاعلية ---
    'road_barriers', 'fuel_stations',
    'city_landmarks', 'supermarket', 'commercial_shops', 'restaurants', 'schools_kindergartens', 'job_vacancies', 
    'electrician', 'ac_technician', 'plumber', 'general_maintenance', 'painter', 'carpenter', 
    'blacksmith', 'builder', 'house_cleaner', 'aluminum_tech', 'glass_tech', 'car_mechanic', 'car_electrician', 
    'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 'delivery_services', 'tow_truck', 
    'cctv_installer', 'party_planner', 'zaffa_bands', 'music_bands', 'Finisher', 'party_rental', 
    'home_nurse', 'masseur', 'cupping_specialist', 'nutritionist', 'truck_driver', 'security_firms', 
    'furniture_buyer', 'gardener', 'pet_care', 'clown_entertainer', 'online_stores', 'villas_rent', 
    'martial_arts_gymnastics', 'public_parks_recreation', 'hotels', 'free_distribution', 'barber_shop', 
    'video_design_ads', 'pharmacies_on_call', 'taxis_on_call', 'emergency_hospitals', 'clinics', 
    'doctors_on_call', 'ambulances_on_call', 'music_training', 'lawyers', 'land_surveyors', 
    'real_estate_valuers', 'private_tutors', 'programmers', 'car_delivery_on_call', 
    'motorcycle_delivery_on_call', 'bicycle_delivery_on_call', 'photographers', 'student_research_assist',
     

    // --- طبقات العقارات والمواقع الفعالة ---
    'ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'
];

const isValidLayer = (layer) => typeof layer === 'string' && ALLOWED_LAYERS.includes(layer.trim());

// =========================================================================
// 🆕 [تشديد أمني]: أسماء الحقول (columns) القادمة من الفرونت إند كانت تُدمج
// مباشرة داخل نص استعلام SQL بدون أي تحقق (في /api/get-unique-values و
// /api/search-features)، وهذا يفتح ثغرة SQL Injection حقيقية عبر تمرير اسم
// حقل خبيث بدل اسم حقيقي. هذه الدالة تتحقق أن الاسم يطابق نمط معرّف SQL
// عادي فقط (حروف/أرقام/شرطة سفلية) قبل استخدامه داخل أي استعلام.
// =========================================================================
const SQL_IDENTIFIER_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const isValidSqlIdentifier = (name) => typeof name === 'string' && SQL_IDENTIFIER_REGEX.test(name);

// =========================================================================
// [نظام حد الطلبات/الأحداث لكل مستخدم]: افتراضياً "مفتوح" بدون أي حد.
// المشرف قادر على تحديد رقم أقصى (مثلاً 20) ونوع الفترة (يومي/أسبوعي/شهري)
// من لوحة إدارة المستخدمين. يتم فحص هذا الحد عند كل "طلب/حدث" (نقرة اتصال
// أو واتساب) قبل تسجيلها، عبر عمود "user_identifier" في جدول الإحصائيات
// الذي يخزن رقم المستخدم الحقيقي (user_id) عند تسجيل الدخول.
// =========================================================================

// =========================================================================
// 🆕 مسار إحصائيات المنصة العامة (صفحة البحث بدون خريطة + فوتر/تبويب الخريطة)
// عام بدون حماية (لا يحتاج تسجيل دخول) لأنه عرض أرقام إجمالية فقط بلا تفاصيل حساسة
// =========================================================================
let platformStatsCache = { data: null, expiresAt: 0 };

app.get('/api/platform-stats', async (req, res) => {
    try {
        // ⚡ كاش بسيط بالذاكرة لمدة 60 ثانية لتفادي ضغط الاستعلامات مع كل زائر
        if (platformStatsCache.data && Date.now() < platformStatsCache.expiresAt) {
            return res.json({ success: true, data: platformStatsCache.data });
        }

        // 1) إحصائيات المستخدمين مجمّعة حسب الدور
        const usersResult = await servicesPool.query(`
            SELECT COALESCE(role, 'user') AS role, COUNT(*) AS count
            FROM public.users
            GROUP BY COALESCE(role, 'user')
        `);

        let usersTotal = 0, usersAdmin = 0, usersUser = 0, usersProvider = 0;
        usersResult.rows.forEach(row => {
            const count = parseInt(row.count, 10) || 0;
            usersTotal += count;
            if (row.role === 'admin') usersAdmin += count;
            else if (row.role === 'provider') usersProvider += count;
            else usersUser += count;
        });

        // 2) عدد المشاهدات = إجمالي الأحداث المسجلة على الخريطة والبحث
        //    (نقرات، بحث، اتصال/واتساب...) من نفس جدول map_service_stats الموجود أصلاً
        const viewsResult = await servicesPool.query(`SELECT COUNT(*) FROM "public"."map_service_stats"`);
        const viewsTotal = parseInt(viewsResult.rows[0].count, 10) || 0;

        // 3) عدد الخدمات (الطبقات) = القائمة البيضاء المعتمدة بالسيرفر بعد استثناء طبقات العقارات/المواقع
        const realEstateAndLocationLayers = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];
        const servicesCount = ALLOWED_LAYERS.filter(l => !realEstateAndLocationLayers.includes(l)).length;

        // 4) عدد المعالم = عدد مزودي الخدمة المرتبطين فعلياً بمعلم حقيقي على الخريطة
        const featuresResult = await servicesPool.query(`
            SELECT COUNT(*) FROM public.users
            WHERE role = 'provider' AND is_active = true
              AND service_layer IS NOT NULL AND feature_id IS NOT NULL
        `);
        const featuresCount = parseInt(featuresResult.rows[0].count, 10) || 0;

        const statsData = { usersTotal, usersAdmin, usersUser, usersProvider, viewsTotal, servicesCount, featuresCount };

        platformStatsCache = { data: statsData, expiresAt: Date.now() + 60000 };

        res.json({ success: true, data: statsData });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب إحصائيات المنصة:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الإحصائيات', details: err.message });
    }
});


async function checkUserRequestQuota(userId) {
    // بدون معرف مستخدم (زائر) => لا يوجد حد مطبق إطلاقاً
    if (!userId) {
        return { allowed: true, unlimited: true };
    }

    try {
        const userResult = await servicesPool.query(
            'SELECT request_limit, request_limit_period FROM public.users WHERE user_id = $1',
            [userId]
        );

        if (userResult.rows.length === 0) {
            // مستخدم غير مسجل بقاعدة البيانات (ضيف مثلاً) => بدون حد
            return { allowed: true, unlimited: true };
        }

        const { request_limit, request_limit_period } = userResult.rows[0];

        // الحد الافتراضي: مفتوح تماماً (بدون أي رقم محدد)
        if (!request_limit || request_limit <= 0) {
            return { allowed: true, unlimited: true };
        }

        const period = ['daily', 'weekly', 'monthly'].includes(request_limit_period) ? request_limit_period : 'daily';
        const intervalMap = { daily: '1 day', weekly: '7 days', monthly: '1 month' };
        const intervalSql = intervalMap[period];

        const countResult = await servicesPool.query(
            `SELECT COUNT(*) FROM "public"."map_service_stats"
             WHERE user_identifier = $1 AND request_date >= NOW() - INTERVAL '${intervalSql}'`,
            [String(userId)]
        );

        const used = parseInt(countResult.rows[0].count, 10) || 0;
        const remaining = Math.max(0, request_limit - used);

        return {
            allowed: used < request_limit,
            unlimited: false,
            limit: request_limit,
            period,
            used,
            remaining
        };
    } catch (err) {
        console.error('⚠️ خطأ أثناء فحص حد الطلبات، سيتم السماح بالطلب (Fail-open):', err.message);
        // في حال أي خطأ غير متوقع لا نمنع المستخدم من استخدام الخدمة الأساسية
        return { allowed: true, unlimited: true, error: true };
    }
}

// =========================================================================
// مسار جلب الخدمة المربوطة بمزود الخدمة والتحقق من اكتمال الحقول مع الإحداثيات
// =========================================================================
app.get('/api/get-provider-service', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم user_id مطلوب' });
    }

    try {
        // الاستعلام عن الحقول من جدول المستخدمين مباشرة مع جلب الرتبة
        const userQuery = `
            SELECT service_layer, feature_id, status, role, x_coord, y_coord 
            FROM public.users 
            WHERE user_id = $1
        `;
        const result = await servicesPool.query(userQuery, [user_id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const userRow = result.rows[0];

        // عزل وتجهيز قيم الطبقة والمعرف مع عمل Trim للنصوص
        let layer = userRow.service_layer ? userRow.service_layer.trim() : null;
        let featId = userRow.feature_id;

        // [حماية SQL]: التحقق من أن الطبقة ضمن القائمة البيضاء
        if (layer && !isValidLayer(layer)) {
            return res.status(403).json({ success: false, error: 'محاولة وصول غير مصرح بها لجدول محمي' });
        }

        // 🛑 [تعديل حاسم]: تم حذف الإسناد التلقائي للنجار 14. إذا كانت الحقول فارغة، نرفض فتح اللوحة فوراً.
        if (!layer || !featId) {
            console.log(`⚠️ مزود الخدمة رقم ${user_id} غير مربوط بأي طبقة جغرافية أو معلم. تم حظر اللوحة ومنع الإسناد الوهمي.`);
            return res.json({ 
                success: false, 
                show_panel: false, 
                message: 'الحساب ليس مزود خدمة مفعّل أو حقول المعالم الجغرافية فارغة تماماً.' 
            });
        }

        // 🔥 [تطوير استراتيجي]: جلب الإحداثيات الحالية مباشرة من جدول الطبقة الديناميكية
        let coordsData = { x_coord: null, y_coord: null, layer_status: userRow.status };
        try {
            const targetPool = getPoolForLayer(layer);
            const isRealEstate = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'].includes(layer);

            // العقارات تستخدم fid، الخدمات تستخدم id
            const idField = isRealEstate ? 'fid' : 'id';

            console.log(`🔍 جلب الإحداثيات: layer=${layer}, idField=${idField}, featId=${featId}, isRealEstate=${isRealEstate}`);

            const coordsQuery = `
                SELECT x_coord, y_coord, status
                FROM public."${layer}"
                WHERE ${idField} = $1
                LIMIT 1
            `;
            const coordsResult = await targetPool.query(coordsQuery, [featId]);
            console.log(`🔍 نتيجة الاستعلام: ${coordsResult.rows.length} صفوف`);
            if (coordsResult.rows.length > 0) {
                console.log(`🔍 البيانات المسترجعة:`, coordsResult.rows[0]);
            }
            if (coordsResult.rows.length > 0) {
                const cRow = coordsResult.rows[0];
                coordsData.x_coord = cRow.x_coord;
                coordsData.y_coord = cRow.y_coord;
                coordsData.layer_status = cRow.status; // جلب الحالة الفعلية من جدول الطبقة

                // 🛡️ [تزامن احترافي]: إذا كانت الإحداثيات في جدول users فارغة، نقوم بتعبئتها الآن
                if (userRow.x_coord === null || userRow.y_coord === null) {
                    await servicesPool.query('UPDATE public.users SET x_coord = $1, y_coord = $2 WHERE user_id = $3',
                    [coordsData.x_coord, coordsData.y_coord, user_id]);
                }
            }
        } catch (coordErr) {
            console.warn(`⚠️ تنبيه: تعذر جلب الإحداثيات المسبقة من جدول [${layer}]:`, coordErr.message);
        }

        // إرجاع البيانات في حال كانت مكتملة ومربوطة بشكل قانوني وصحيح
        res.json({
            success: true,
            show_panel: true,
            user_status: parseInt(userRow.status), // إرسال الحالة الإدارية (0 نشط، 1 مجمد)
            service: {
                service_layer: layer,
                feature_id: featId, 
                id: featId,         
                status: coordsData.layer_status !== null ? parseInt(coordsData.layer_status) : parseInt(userRow.status),
                x_coord: coordsData.x_coord,
                y_coord: coordsData.y_coord,
                x_global: coordsData.x_global,
                y_global: coordsData.y_global
            }
        });

    } catch (err) {
        console.error('❌ خطأ أثناء جلب بيانات خدمة المزود:', err.message);
        res.status(500).json({ success: false, error: 'خطأ داخلي في الخادم', details: err.message });
    }
});

// =========================================================================
// مسار تحديث الحالة والموقع الجغرافي الذكي (يدعم الخدمات والعقارات)
// =========================================================================
app.post('/api/update-service-status', async (req, res) => {
    const { 
        user_id, 
        service_layer, 
        feature_id, 
        id, 
        status, 
        x_coord, 
        y_coord 
    } = req.body;

    const targetIdValue = feature_id || id;
    const layerName = service_layer ? service_layer.trim() : null;

    if (!user_id || !layerName || !targetIdValue) {
        return res.status(400).json({ success: false, error: 'بيانات التحديث غير مكتملة، المعرفات والطبقة الجغرافية حقول إجبارية.' });
    }

    if (!isValidLayer(layerName)) {
        return res.status(403).json({ success: false, error: 'غير مسموح بالتعامل مع هذه الطبقة برمجياً' });
    }

    const parsedStatus = status !== undefined ? parseInt(status) : 0;
    const parsedXCoord = x_coord ? Number(x_coord) : null;
    const parsedYCoord = y_coord ? Number(y_coord) : null;

    // مصفوفة طبقات العقارات لتحديد السلوك برمجياً
    const isRealEstate = REAL_ESTATE_LAYERS.includes(layerName);

    try {
        const targetPool = getPoolForLayer(layerName);
        let updateLayerQuery = '';
        let queryParams = [];

        // العقارات تستخدم fid، الخدمات تستخدم id
        const idField = isRealEstate ? 'fid' : 'id';

        // التحقق مما إذا كان الطلب يتضمن إحداثيات جديدة
        if (parsedXCoord && parsedYCoord && parsedXCoord > 100000) {

            if (isRealEstate && layerName !== 'Location') {
                // 🏢 [حالة خاصة بالعقارات والمضلعات]: تحديث الإحداثيات كأعمدة رقمية فقط دون المساس بالـ geom المضلع
                // لأن المضلع (Polygon) لا يمكن تحديثه بنقطة واحدة مباشرة من الفرونت إند عبر ST_MakePoint
                console.log(`🏢 تحديث عقار/مضلع: Layer=[${layerName}], ID=[${targetIdValue}]`);
                updateLayerQuery = `
                    UPDATE public."${layerName}"
                    SET
                        status = $1,
                        x_coord = $2,
                        y_coord = $3
                    WHERE ${idField} = $4
                `;
                queryParams = [parsedStatus, parsedXCoord, parsedYCoord, targetIdValue];
            } else {
                // 🟢 [حالة الخدمات أو نقاط المواقع]: تحديث الأعمدة الرقمية وتحديث هندسة النقطة (Point) في الـ PostGIS
                console.log(`🟢 تحديث نقطة/خدمة: Layer=[${layerName}], ID=[${targetIdValue}]`);
                updateLayerQuery = `
                    UPDATE public."${layerName}"
                    SET
                        status = $1,
                        x_coord = $2,
                        y_coord = $3,
                        geom = ST_SetSRID(ST_MakePoint($2, $3), 28191)
                    WHERE ${idField} = $4
                `;
                queryParams = [parsedStatus, parsedXCoord, parsedYCoord, targetIdValue];
            }
        } else {
            // 📍 تحديث الحالة فقط في حال عدم إرسال إحداثيات جديدة
            console.log(`📍 تحديث حالة فقط: Layer=[${layerName}], ID=[${targetIdValue}]`);
            updateLayerQuery = `
                UPDATE public."${layerName}"
                SET status = $1
                WHERE ${idField} = $2
            `;
            queryParams = [parsedStatus, targetIdValue];
        }

        // تنفيذ استعلام التحديث على قاعدة البيانات الصحيحة (العقارات أو الخدمات)
        const updateResult = await targetPool.query(updateLayerQuery, queryParams);

        // 🔄 [مزامنة ذكية]: نقوم بتحديث جدول الـ users للخدمات والعقارات
        if (parsedXCoord && parsedYCoord) {
            const syncUserCoords = `UPDATE public.users SET x_coord = $1, y_coord = $2 WHERE user_id = $3`;
            await servicesPool.query(syncUserCoords, [parsedXCoord, parsedYCoord, user_id]);
            console.log(`🔄 تم تزامن إحداثيات مزود الخدمة في جدول المستخدمين.`);
        }

        console.log(`\x1b[36m%s\x1b[0m`, `🎯 [نجاح التحديث] تم تحديث البيانات بنجاح للطبقة [${layerName}] المعلم [${targetIdValue}]`);

        res.json({ 
            success: true, 
            message: `تم تحديث الطبقة [${layerName}] بنجاح وتفادي تعارض هندسة المضلعات.` 
        });

    } catch (err) {
        console.error(`❌ خطأ أثناء تحديث الطبقة [${layerName}]:`, err.message);
        res.status(500).json({ 
            success: false, 
            error: 'فشل تحديث قاعدة البيانات الخلفية', 
            details: err.message 
        });
    }
});
// 3. إعداد البروكسي لـ GeoServer
// [إجراء أمني 2]: تشفير وحماية البروكسي لمنع الحذف العشوائي (WFS-T protection)
app.use('/geoserver-proxy', (req, res, next) => {
    console.log(`[Proxy] Request to: ${req.url} from IP: ${req.ip}`);
    console.log(`[Proxy] GeoServer Target: ${GEOSERVER_TARGET}`);
    next();
}, createProxyMiddleware({
    target: GEOSERVER_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/geoserver-proxy': '' },
    secure: false, // للتعامل مع شهادات SSL غير الموثوقة
    timeout: 60000,
    proxyTimeout: 60000,
    logLevel: 'debug',
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Forwarding to: ${GEOSERVER_TARGET}${req.url}`);
        console.log(`[Proxy] Content-Type: ${req.headers['content-type']}`);
        console.log(`[Proxy] Body length: ${req.body ? Buffer.byteLength(req.body) : 0}`);

        // ❌ قمنا بحذف سطر حقن الحساب التلقائي (zeed) تماماً من هنا

        // الحفاظ على بيانات الـ Body للطلبات القادمة من الخريطة
        const contentType = req.headers['content-type'] || '';
        if (req.body) {
            if (contentType.includes('application/json')) {
                const bodyData = JSON.stringify(req.body);
                proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                proxyReq.write(bodyData);
            } else if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
                // للطلبات XML (WFS-T)
                proxyReq.setHeader('Content-Length', Buffer.byteLength(req.body));
                proxyReq.write(req.body);
            }
        }
    },
    onError: (err, req, res) => {
        console.error('[Proxy] Error:', err.message);
        console.error('[Proxy] GeoServer Target:', GEOSERVER_TARGET);
        console.error('[Proxy] Request URL:', req.url);
        if (!res.headersSent) {
            res.status(502).json({
                error: 'GeoServer connection failed',
                details: err.message,
                target: GEOSERVER_TARGET,
                url: req.url,
                hint: 'تأكد من أن GeoServer يعمل على العنوان المحدد وأن السيرفر Node.js يعمل'
            });
        }
    }
}));

// 4-أ. مسار فحص حد الطلبات قبل تنفيذ أي "حدث/نقرة" (اتصال أو واتساب) - يُستدعى
// من الواجهة الأمامية قبل فتح رابط الاتصال أو الواتساب فعلياً
app.post('/api/check-request-limit', async (req, res) => {
    const { user_id } = req.body;
    const quota = await checkUserRequestQuota(user_id);
    res.json({ success: true, ...quota });
});

// 4-ب. مسار تسجيل حدث/نقرة على الخريطة أو البحث (يُستدعى عند كل نقرة)
app.post('/api/log-map-event', async (req, res) => {
    const { user_id, event_type, provider, service } = req.body;

    console.log("📥 تسجيل حدث خريطة/بحث:", req.body);

    if (!user_id || !event_type) {
        console.log("⚠️ بيانات ناقصة في تسجيل الحدث");
        return res.status(400).json({ error: 'Missing required fields' });
    }

    try {
        // 🛡️ فحص حد الطلبات كحاجز أمان على مستوى السيرفر
        const quota = await checkUserRequestQuota(user_id);
        if (!quota.allowed) {
            console.log(`⛔ تم رفض الحدث: المستخدم ${user_id} تجاوز الحد المسموح (${quota.limit} / ${quota.period})`);
            return res.status(429).json({
                error: 'تم تجاوز الحد المسموح من الطلبات لهذه الفترة',
                quota
            });
        }

        const query = `
            INSERT INTO "public"."map_service_stats" ("user_identifier", "provider_name", "service_type", "request_date")
            VALUES ($1, $2, $3, NOW())
        `;

        await servicesPool.query(query, [user_id, provider || null, event_type]);

        console.log(`\x1b[32m%s\x1b[0m`, `✅ نجاح تسجيل الحدث: ${event_type}`);
        res.status(200).json({ status: 'success', message: 'Event logged successfully' });
    } catch (err) {
        console.error('❌ خطأ داخلي في SQL أثناء تسجيل الحدث:', err.message);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message 
        });
    }
});

// 4. مسار استقبال الإحصائيات (POST)
app.post('/save-stat', async (req, res) => {
    const { user_id, provider, service } = req.body;

    console.log("📥 استلام بيانات جديدة للحفظ:", req.body);

    if (!user_id || !provider || !service) {
        console.log("⚠️ بيانات ناقصة في الطلب المستلم");
        return res.status(400).json({ error: 'Missing data fields' });
    }

    try {
        // 🛡️ فحص حد الطلبات كحاجز أمان أخير على مستوى السيرفر (حتى لو تجاوزته الواجهة الأمامية)
        const quota = await checkUserRequestQuota(user_id);
        if (!quota.allowed) {
            console.log(`⛔ تم رفض الطلب: المستخدم ${user_id} تجاوز الحد المسموح (${quota.limit} / ${quota.period})`);
            return res.status(429).json({
                error: 'تم تجاوز الحد المسموح من الطلبات لهذه الفترة',
                quota
            });
        }

        const query = `
            INSERT INTO "public"."map_service_stats" ("user_identifier", "provider_name", "service_type", "request_date")
            VALUES ($1, $2, $3, NOW())
        `;

        await servicesPool.query(query, [user_id, provider, service]);

        console.log(`\x1b[32m%s\x1b[0m`, `✅ نجاح الحفظ في قاعدة البيانات للخدمة: ${service}`);
        res.status(200).json({ status: 'success', message: 'Stat saved successfully' });
    } catch (err) {
        console.error('❌ خطأ داخلي في SQL أثناء الحفظ:', err.message);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: err.message 
        });
    }
});

// 5. مسار جلب السجلات التفصيلية مع التصفح الصفحي (Pagination)
app.get('/api/stats-detailed', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10; 
        const offset = (page - 1) * limit;

        console.log(`📋 جلب السجلات - الصفحة: ${page}`);

        const dataQuery = `
            SELECT 
                s.id, 
                s.user_identifier,
                COALESCE(u.full_name, s.user_identifier) as user_name,
                COALESCE(u.phone, '---') as user_phone,
                s.provider_name, 
                s.service_type, 
                TO_CHAR(s.request_date, 'YYYY-MM-DD HH24:MI:SS') as formatted_date
            FROM "public"."map_service_stats" s
            LEFT JOIN "public"."users" u ON u.user_id::text = s.user_identifier
            WHERE (s.service_type ILIKE '%اتصال%' OR s.service_type ILIKE '%واتساب%')
            ORDER BY s.request_date DESC 
            LIMIT $1 OFFSET $2
        `;

        const countQuery = `
            SELECT COUNT(*) FROM "public"."map_service_stats" s
            WHERE (s.service_type ILIKE '%اتصال%' OR s.service_type ILIKE '%واتساب%')
        `;

        const [dataRes, countRes] = await Promise.all([
            servicesPool.query(dataQuery, [limit, offset]),
            servicesPool.query(countQuery)
        ]);

        const totalRecords = parseInt(countRes.rows[0].count);
        const totalPages = Math.ceil(totalRecords / limit);

        res.json({
            data: dataRes.rows,
            totalPages: totalPages,
            currentPage: page,
            totalRecords: totalRecords
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب البيانات التفصيلية:', err.message);
        res.status(500).json({ error: 'Failed to fetch logs', details: err.message });
    }
});

// 6. مسار حذف سجل معين (DELETE)
app.delete('/api/delete-stat/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const query = 'DELETE FROM "public"."map_service_stats" WHERE id = $1';
        await servicesPool.query(query, [id]);

        console.log(`🗑️ تم حذف السجل رقم: ${id} بنجاح`);
        res.status(200).json({ status: 'success', message: `Record ${id} deleted` });
    } catch (err) {
        console.error('❌ خطأ أثناء حذف السجل:', err.message);
        res.status(500).json({ error: 'Failed to delete record', details: err.message });
    }
});

// 7. مسار ملخص الإحصائيات
app.get('/api/stats-summary', async (req, res) => {
    try {
        const query = `SELECT service_type, COUNT(*) as total_requests FROM "public"."map_service_stats" GROUP BY service_type ORDER BY total_requests DESC`;
        const result = await servicesPool.query(query);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// 1️⃣ مسار تسجيل مستخدم جديد
// ==========================================
app.post('/api/auth/register', authLimiter, async (req, res) => {
    const { name, email = '', phone, password, role, whatsapp_number = '' } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedWhatsapp = whatsapp_number ? normalizeWhatsappNumber(whatsapp_number) : null;

    console.log("📥 محاولة تسجيل حساب جديد تلقائي:", req.body);

    if (!name || !phone || !password || !role) {
        return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة بما فيها رقم الجوال' });
    }
    if (whatsapp_number && !normalizedWhatsapp) {
        return res.status(400).json({ error: 'رقم واتساب غير صالح، يرجى إدخال رقم صحيح مع رمز الدولة.' });
    }

    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({ error: 'صيغة رقم الجوال غير صحيحة، يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.' });
    }

    try {
        if (normalizedEmail) {
            const checkEmailQuery = 'SELECT email FROM public.users WHERE email = $1';
            const emailCheckResult = await servicesPool.query(checkEmailQuery, [normalizedEmail]);

            if (emailCheckResult.rows.length > 0) {
                return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل!' });
            }
        }

        const checkPhoneQuery = 'SELECT phone FROM public.users WHERE phone = $1';
        const phoneCheckResult = await servicesPool.query(checkPhoneQuery, [phone.trim()]);

        if (phoneCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'رقم الجوال هذا مستخدم بالفعل من قبل حساب آخر!' });
        }

        // 🆕 [إصلاح ثغرة حرجة]: تشفير كلمة المرور بـ bcrypt قبل حفظها، بدل حفظها
        // كنص صريح بقاعدة البيانات (أي تسريب لقاعدة البيانات كان سيكشف كل
        // كلمات مرور المستخدمين فوراً وبدون أي جهد).
        const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);

        const insertUserQuery = `
            INSERT INTO public.users (full_name, email, phone, password_hash, role, status, is_active, whatsapp_number)
            VALUES ($1, $2, $3, $4, $5, 0, false, $6)
            RETURNING user_id, full_name, email, phone, role, whatsapp_number
        `;

        const result = await servicesPool.query(insertUserQuery, [
            name.trim(),
            normalizedEmail,
            phone.trim(),
            hashedPassword,
            role,
            normalizedWhatsapp
        ]);

        const newUser = result.rows[0];
        console.log(`✅ تم إنشاء حساب جديد بنجاح برقم ID: ${newUser.user_id}`);

        res.status(201).json({
            status: 'success',
            message: 'تم التسجيل بنجاح في المنصة!',
            user: newUser
        });

    } catch (err) {
        console.error('❌ خطأ أثناء تسجيل المستخدم في قاعدة البيانات:', err.message);

        if (err.code === '28P01') {
            return res.status(401).json({
                error: 'فشل مصادقة قاعدة البيانات. تحقق من اسم المستخدم وكلمة المرور الخاصة بقاعدة PostgreSQL.',
                details: err.message
            });
        }

        if (err.code === '3D000' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
            return res.status(502).json({
                error: 'تعذر الوصول إلى خادم PostgreSQL أو قاعدة البيانات غير موجودة.',
                details: err.message
            });
        }

        res.status(500).json({ 
            error: 'حدث خطأ داخلي بالسيرفر أثناء إنشاء الحساب',
            details: err.message 
        });
    }
}); 

// ==========================================
// 2️⃣ مسار تغيير كلمة المرور للمستخدم (التحقق من الحالية ثم كتابة الجديدة)
// ==========================================
app.post('/api/auth/change-password', async (req, res) => {
    const { userId, currentPassword, newPassword } = req.body;

    console.log(`📥 محاولة تغيير كلمة المرور للمستخدم رقم: ${userId}`);

    // التأكد من إرسال كافة البيانات المطلوبة
    if (!userId || !currentPassword || !newPassword) {
        return res.status(400).json({ error: 'الرجاء إدخال كلمة المرور الحالية وكلمة المرور الجديدة.' });
    }

    if (newPassword.trim().length < 6) {
        return res.status(400).json({ error: 'يجب أن تتكون كلمة المرور الجديدة من 6 خانات على الأقل.' });
    }

    try {
        // 1. جلب كلمة المرور الحالية المخزنة في قاعدة البيانات لهذا المستخدم
        const getUserQuery = 'SELECT password_hash FROM public.users WHERE user_id = $1';
        const userResult = await servicesPool.query(getUserQuery, [userId]);

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'المستخدم غير موجود في النظام!' });
        }

        const storedPassword = userResult.rows[0].password_hash;

        // 2. مقارنة كلمة المرور المدخلة بالحالية - يدعم الحسابات المشفرة
        //    بـ bcrypt والحسابات القديمة (نصية) على حد سواء
        const { valid } = await verifyPasswordWithMigration(currentPassword, storedPassword);
        if (!valid) {
            return res.status(400).json({ error: 'كلمة المرور الحالية التي أدخلتها غير صحيحة!' });
        }

        // 3. تحديث كلمة المرور الجديدة في قاعدة البيانات (مشفّرة دائماً بـ bcrypt)
        const hashedNewPassword = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
        const updatePasswordQuery = `
            UPDATE public.users 
            SET password_hash = $1 
            WHERE user_id = $2
        `;
        await servicesPool.query(updatePasswordQuery, [hashedNewPassword, userId]);

        console.log(`✅ تم تحديث كلمة المرور بنجاح للمستخدم رقم: ${userId}`);

        res.status(200).json({
            status: 'success',
            message: 'تم تغيير كلمة المرور بنجاح!'
        });

    } catch (err) {
        console.error('❌ خطأ أثناء تغيير كلمة المرور في قاعدة البيانات:', err.message);
        res.status(500).json({ 
            error: 'حدث خطأ داخلي بالسيرفر أثناء تعديل كلمة المرور',
            details: err.message 
        });
    }
}); 

// =========================================================================
// 🆕 مسار التحقق من صلاحية الجلسة المحفوظة محلياً (يُستدعى عند كل دخول
// تلقائي autoboot في auth-app-events.js قبل السماح بالدخول للمنصة). يمنع
// دخول أي مستخدم تم تسجيل خروجه إجبارياً أو تعطيل حسابه من قبل الإدارة،
// حتى لو كان غير متصل بالإنترنت وقت تنفيذ الإجراء من لوحة التحكم.
// =========================================================================
app.post('/api/auth/verify-session', async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ valid: false, reason: 'missing_user_id' });
    }

    try {
        const result = await servicesPool.query(
            'SELECT is_active, force_logout_flag FROM public.users WHERE user_id = $1',
            [user_id]
        );

        if (result.rows.length === 0) {
            return res.json({ valid: false, reason: 'not_found' });
        }

        const { is_active, force_logout_flag } = result.rows[0];

        if (!is_active) {
            return res.json({ valid: false, reason: 'inactive' });
        }

        if (force_logout_flag === true) {
            return res.json({ valid: false, reason: 'force_logout' });
        }

        return res.json({ valid: true });
    } catch (err) {
        console.error('❌ خطأ أثناء التحقق من صلاحية الجلسة:', err.message);
        // Fail-open عند خطأ سيرفر مؤقت (شبكة/قاعدة بيانات) حتى لا نمنع مستخدمين
        // شرعيين من الدخول بسبب عطل عابر لا علاقة له بصلاحية الجلسة فعلياً
        return res.json({ valid: true, error: true });
    }
});

// مسار تسجيل الدخول المحدث (الفحص الثلاثي المتطابق الشامل بدون أي قيم وهمية)
app.post('/api/auth/login', authLimiter, async (req, res) => {
    const requestBody = req.body || {};
    const { email = '', phone, password } = requestBody;
    const normalizedEmail = (email || '').toLowerCase().trim();
    const normalizedPhone = phone ? phone.trim() : '';

    if (!normalizedPhone || !password) {
        console.warn('[LOGIN] missing fields', { email: normalizedEmail, phone: normalizedPhone, password: !!password, body: requestBody });
        return res.status(400).json({ message: 'الرجاء إدخال رقم الجوال وكلمة المرور.' });
    }

    try {
        let userQuery = 'SELECT * FROM public.users WHERE phone = $1';
        let queryParams = [normalizedPhone];

        if (normalizedEmail) {
            userQuery = 'SELECT * FROM public.users WHERE email = $1 AND phone = $2';
            queryParams = [normalizedEmail, normalizedPhone];
        }

        console.log('[LOGIN] query params', { email: normalizedEmail, phone: normalizedPhone });
        const result = await servicesPool.query(userQuery, queryParams);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'البيانات المدخلة غير صحيحة، يرجى التأكد من البريد الإلكتروني ورقم الجوال.' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: 'خطأ في الدخول: هذا الحساب معطل حالياً، يرجى التواصل معنا عبر صفحة الفيس بوك لإصلاح الخطأ.' });
        }

        // 🆕 [إصلاح ثغرة حرجة]: التحقق من كلمة المرور يدعم الآن bcrypt، مع
        // ترحيل شفاف للحسابات القديمة (كانت مخزَّنة كنص صريح) إلى bcrypt فور
        // أول تسجيل دخول ناجح لها، بدل مقارنة نصية مباشرة كما كان سابقاً.
        const { valid: passwordValid, needsRehash } = await verifyPasswordWithMigration(password, user.password_hash);
        if (!passwordValid) {
            return res.status(401).json({ message: 'كلمة المرور المدخلة غير صحيحة.' });
        }

        if (needsRehash) {
            const migratedHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
            await servicesPool.query('UPDATE public.users SET password_hash = $1 WHERE user_id = $2', [migratedHash, user.user_id]);
            console.log(`🔐 تم ترحيل كلمة مرور المستخدم ${user.user_id} من نص صريح إلى bcrypt.`);
        }

        // 🆕 إعادة تفعيل الحساب: تسجيل الدخول الناجح يلغي أي علامة "تسجيل خروج
        // إجباري" سابقة كانت مفعّلة من قبل الإدارة، حتى يستطيع المستخدم
        // استخدام المنصة بشكل طبيعي بعد إعادة الدخول الصريحة ببياناته.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = false WHERE user_id = $1', [user.user_id]);

        // 🛑 [إصلاح حاسم للأمان وجذر المشكلة]: إرجاع القيمة الفعلية من الداتابيز فقط (null إذا لم يكن مربوطاً)
        // تم إلغاء فرض طبقة النجار carpenter والمعلم 14 للحسابات غير المربوطة بشكل كامل هنا.
        const finalLayer = user.service_layer ? user.service_layer.trim() : null;
        const finalId = user.feature_id ? user.feature_id : null;

        res.status(200).json({
            message: 'تم تسجيل الدخول بنجاح بالمطابقة الكاملة الثلاثية المشروطة ببيانات قاعدة البيانات الحقيقية',
            user: {
                user_id: user.user_id,
                id: user.user_id,
                full_name: user.full_name,
                email: user.email,
                phone: user.phone,
                whatsapp_number: user.whatsapp_number || null,
                role: user.role,
                status: user.status !== null ? parseInt(user.status) : 0,
                target_layer: finalLayer,
                targetId: finalId,
                target_id: finalId,
                x_coord: user.x_coord,
                y_coord: user.y_coord
            }
        });

    } catch (error) {
        console.error('Database Login Error:', error);
        console.error('[LOGIN] request body:', requestBody);
        res.status(500).json({ message: 'حدث خطأ في الخادم أثناء عملية تسجيل الدخول الثلاثية المشروطة.' });
    }
});

// 8. API لجلب القيم الفريدة من PostgreSQL مباشرة (أسرع من GeoServer)
app.get('/api/get-unique-values', async (req, res) => {
    try {
        const { layer, workspace, field } = req.query;

        if (!layer || !workspace || !field) {
            return res.status(400).json({ error: 'layer, workspace, and field are required' });
        }

        // 🆕 [إصلاح ثغرة SQL Injection]: layer و field كانا يُدمَجان مباشرة داخل
        // نص الاستعلام بدون أي تحقق. الآن نتحقق أن layer ضمن القائمة البيضاء
        // المعتمدة وأن field يطابق نمط معرّف SQL عادي فقط قبل استخدامهما.
        if (!isValidLayer(layer)) {
            return res.status(403).json({ error: 'اسم طبقة غير مسموح به.' });
        }
        if (!isValidSqlIdentifier(field)) {
            return res.status(400).json({ error: 'اسم حقل غير صالح.' });
        }

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;

        // استعلام لجلب القيم الفريدة من الحقل المحدد
        const query = `SELECT DISTINCT "${field}" FROM public."${layer}" WHERE status = 0 AND auto_status = 0 AND "${field}" IS NOT NULL AND "${field}"::text != '' ORDER BY "${field}" ASC LIMIT 10000`;

        console.log(`Unique Values Query for ${layer}.${field}:`, query);

        const result = await targetPool.query(query);

        const values = result.rows.map(row => row[field]).filter(v => v != null && v !== '');

        res.json({
            success: true,
            values: values
        });

    } catch (error) {
        console.error('Unique Values API Error:', error);
        console.error('Error details:', error.message);
        res.status(500).json({ error: 'Database query failed', details: error.message });
    }
});

// 9. API للبحث مع فلترة مكانية BBOX (لعمليات البحث الأربعة)
app.get('/api/search-features', async (req, res) => {
    try {
        const { layer, workspace, field, operator, value, bbox, layerNameAr, conditions_count } = req.query;

        if (!layer || !workspace) {
            return res.status(400).json({ error: 'layer and workspace are required' });
        }

        // 🆕 [إصلاح ثغرة SQL Injection]: layer وأسماء الحقول (field / field_N) كانت
        // تُدمَج مباشرة داخل نص الاستعلام بدون أي تحقق - أخطر نقطة كانت حلقة
        // field_${i} القادمة مباشرة من query params العميل. الآن نتحقق من كل
        // اسم حقل ضد نمط معرّف SQL عادي، ونتجاهل أي شرط لا يطابقه بدل تنفيذه.
        if (!isValidLayer(layer)) {
            return res.status(403).json({ error: 'اسم طبقة غير مسموح به.' });
        }

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;
        const isRealEstate = REAL_ESTATE_LAYERS.includes(layer);
        const isPolygonLayer = layer === 'LandSale'; // الأراضي هي مضلعات

        // بناء استعلام البحث مع فلترة status = 0 AND auto_status = 0
        let query = `SELECT *, ST_AsGeoJSON(geom) as geom_json FROM public."${layer}" WHERE status = 0 AND auto_status = 0`;
        const params = [];

        // إضافة فلترة مكانية BBOX إذا تم توفيرها
        if (bbox) {
            const [minX, minY, maxX, maxY] = bbox.split(',').map(Number);
            if (isPolygonLayer) {
                // للمضلعات: استخدام ST_Intersects مع المربع المكاني
                query += ` AND ST_Intersects(ST_MakeEnvelope($${params.length + 1}, $${params.length + 2}, $${params.length + 3}, $${params.length + 4}, 28191), geom)`;
                params.push(minX, minY, maxX, maxY);
            } else {
                // للنقاط: استخدام x_coord و y_coord
                query += ` AND x_coord >= $${params.length + 1} AND x_coord <= $${params.length + 2}`;
                params.push(minX, maxX);
                query += ` AND y_coord >= $${params.length + 1} AND y_coord <= $${params.length + 2}`;
                params.push(minY, maxY);
            }
        }

                // 🆕 معالجة الشروط المتعددة بمنطق منطقي حقيقي: نجمع الشروط في "مجموعات" -
        // داخل نفس المجموعة يتم الربط بـ OR، وبين المجموعات المختلفة يتم الربط بـ AND.
        // حقول توفر الوقود الثلاثة (ديزل/بنزين95/بنزين98) تُعامل كمجموعة واحدة رغم
        // اختلاف أسمائها، حتى يعمل "ديزل غير متوفر أو بنزين95 غير متوفر" كما هو متوقع.
        // حقل حالة الحاجز (stop) يُجمَّع تلقائياً مع نفسه (نفس الحقل) فتصبح عدة قيم
        // مختارة له (مفتوح/مغلق/أزمة...) بمنطق OR أيضاً. باقي الحقول (السعر، المنطقة،
        // الاسم...) تبقى AND تماماً كما كانت، لأنها مجموعات منفصلة عن بعضها.
        const FUEL_AVAILABILITY_FIELDS = ['diesel', 'banzen95', 'banzen98'];
        function getConditionGroupKey(fieldName) {
            if (FUEL_AVAILABILITY_FIELDS.includes(fieldName)) return '__fuel_availability_group__';
            return fieldName;
        }

        const count = parseInt(conditions_count) || 0;
        const rawConditions = [];
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const condField = req.query[`field_${i}`];
                const condOperator = req.query[`operator_${i}`];
                const condValue = req.query[`value_${i}`];
                if (!isValidSqlIdentifier(condField)) continue;
                if (condField && condValue !== undefined && condValue !== '') {
                    rawConditions.push({ field: condField, operator: condOperator, value: String(condValue).trim() });
                }
            }
        } else if (field && value && isValidSqlIdentifier(field)) {
            rawConditions.push({ field, operator, value: String(value).trim() });
        }

        const groupedConditions = {};
        rawConditions.forEach(c => {
            const groupKey = getConditionGroupKey(c.field);
            if (!groupedConditions[groupKey]) groupedConditions[groupKey] = [];
            groupedConditions[groupKey].push(c);
        });

        Object.keys(groupedConditions).forEach(groupKey => {
            const orParts = [];
            groupedConditions[groupKey].forEach(c => {
                const fieldName = c.field;
                if (c.operator === '=') {
                    orParts.push(`${fieldName} = $${params.length + 1}`);
                    params.push(c.value);
                } else if (c.operator === 'contains') {
                    if (fieldName === 'search_tags') {
                        // 🆕 بحث ذكي بمنطق OR على مستوى الكلمات: يطابق إذا وُجدت أي كلمة
                        // من كلمات البحث (مفصولة بمسافات) داخل الكلمات الدلالية أو الوصف
                        // أو الاسم (للخدمات فقط) أو اسم الطبقة بالعربي - بدل شرط AND
                        // الصارم القديم الذي كان يتطلب تطابق الجملة كاملة كنص واحد.
                        const searchColumns = isRealEstate ? ['search_tags', 'des'] : ['search_tags', 'des', 'name'];
                        const words = c.value.split(/\s+/).filter(w => w.length > 0);
                        const wordGroups = words.map(word => {
                            const colParts = searchColumns.map(col => {
                                params.push(`%${word}%`);
                                return `${col} ILIKE $${params.length}`;
                            });
                            if (layerNameAr) {
                                params.push(layerNameAr);
                                params.push(`%${word}%`);
                                colParts.push(`$${params.length - 1} ILIKE $${params.length}`);
                            }
                            return `(${colParts.join(' OR ')})`;
                        });
                        if (wordGroups.length > 0) orParts.push(`(${wordGroups.join(' OR ')})`);
                    } else {
                        orParts.push(`${fieldName} ILIKE $${params.length + 1}`);
                        params.push(`%${c.value}%`);
                    }
                } else if (c.operator === '>') {
                    orParts.push(`CAST(${fieldName} AS NUMERIC) >= $${params.length + 1}`);
                    params.push(parseFloat(c.value));
                } else if (c.operator === '<') {
                    orParts.push(`CAST(${fieldName} AS NUMERIC) <= $${params.length + 1}`);
                    params.push(parseFloat(c.value));
                }
            });
            if (orParts.length > 0) {
                query += ` AND (${orParts.join(' OR ')})`;
            }
        });

        query += ` ORDER BY rating DESC`;

        console.log(`Search Query for ${layer}:`, query);
        console.log(`Search Params:`, params);

        const result = await targetPool.query(query, params);

        // تحويل النتائج إلى GeoJSON
        // تحويل النتائج إلى GeoJSON
        const features = result.rows.map(row => {
            let geometry;

            if (isPolygonLayer && row.geom_json) {
                // للمضلعات: استخدام geom_json (GeoJSON من PostGIS)
                geometry = JSON.parse(row.geom_json);
            } else {
                // للنقاط: استخدام x_coord و y_coord أولاً
                let xVal = (row.x_coord !== null && row.x_coord !== undefined) ? Number(row.x_coord) : null;
                let yVal = (row.y_coord !== null && row.y_coord !== undefined) ? Number(row.y_coord) : null;

                // 🆕 [إصلاح]: بعض الطبقات (مثل المُضافة حديثاً عبر استيراد مباشر
                // لقاعدة البيانات بدل نموذج الإضافة بالتطبيق) قد تملك عمود geom
                // الحقيقي (PostGIS) معبّأً، لكن عمودي x_coord/y_coord فارغين
                // (NULL) لأنه لا أحد مرّ بها عبر النموذج الذي يعبّئهما تلقائياً.
                // في هذه الحالة نستخرج الإحداثيات احتياطياً من geom_json نفسه
                // بدل إرجاع [null, null] التي تكسر زر "الانتقال إلى الخريطة".
                if ((xVal === null || xVal === undefined) && row.geom_json) {
                    try {
                        const parsedGeom = JSON.parse(row.geom_json);
                        if (parsedGeom && parsedGeom.type === 'Point' && Array.isArray(parsedGeom.coordinates)) {
                            xVal = parsedGeom.coordinates[0];
                            yVal = parsedGeom.coordinates[1];
                        }
                    } catch (e) { /* تجاهل خطأ التحليل، ستبقى القيم كما هي */ }
                }

                geometry = {
                    type: 'Point',
                    coordinates: [xVal, yVal]
                };
            }
            // إزالة الحقول الهندسية من الخصائص
            const { x_coord, y_coord, geom, geom_json, ...properties } = row;

            return {
                type: 'Feature',
                geometry: geometry,
                properties: properties
            };
        });

        res.json({
            type: 'FeatureCollection',
            features: features
        });

    } catch (error) {
        console.error('Search API Error:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Database query failed', details: error.message });
    }
});

// API لجلب قائمة المستخدمين
app.get('/api/users', requireAdmin, async (req, res) => {
    try {
        const query = `
            SELECT user_id as id, full_name as name, email, phone, role
            FROM public.users
            ORDER BY user_id ASC
        `;
        const result = await servicesPool.query(query);

        res.json({
            success: true,
            users: result.rows
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to fetch users', details: error.message });
    }
});

// ==========================================
// API - إدارة المستخدمين (للمشرف فقط)
// ==========================================

// =========================================================================
// 🆕 [إصلاح ثغرة حرجة]: كانت هذه الدالة معرّفة لكن غير مستخدمة إطلاقاً على أي
// من مسارات /api/admin/*، أي أن أي شخص (حتى بدون تسجيل دخول) كان قادراً على
// استدعاء تلك المسارات مباشرة (مثلاً عبر Postman) وتعديل صلاحيات أي مستخدم
// أو تسجيل خروج الجميع، لأن الحماية كانت موجودة فقط بواجهة المتصفح
// (access-guard-style) وهي حماية شكلية يسهل تجاوزها من console المتصفح.
//
// الآن أصبحت middleware حقيقية تُطبَّق على كل مسارات الأدمن: تتحقق من هيدر
// x-admin-user-id (يرسله الفرونت إند مع كل طلب)، وتتأكد أن صاحب هذا المعرّف
// فعلاً role = 'admin' وأن حسابه مُفعّل وغير مسجَّل خروجه إجبارياً، قبل
// السماح للطلب بالمتابعة. أي طلب بدون هيدر صالح يُرفض بـ 403 فوراً.
// =========================================================================
async function requireAdmin(req, res, next) {
    const adminUserId = req.headers['x-admin-user-id'];
    if (!adminUserId) {
        return res.status(401).json({ success: false, error: 'مطلوب تسجيل دخول كمشرف (هيدر x-admin-user-id مفقود).' });
    }

    try {
        const result = await servicesPool.query(
            'SELECT role, is_active, force_logout_flag FROM public.users WHERE user_id = $1',
            [adminUserId]
        );

        if (result.rows.length === 0) {
            return res.status(403).json({ success: false, error: 'حساب المشرف غير موجود.' });
        }

        const { role, is_active, force_logout_flag } = result.rows[0];

        if (role !== 'admin' || !is_active || force_logout_flag === true) {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية المشرف اللازمة لهذا الإجراء.' });
        }

        next();
    } catch (e) {
        console.error('❌ خطأ في التحقق من صلاحية المشرف:', e.message);
        // 🛡️ عند حدوث خطأ في التحقق نفسه (وليس بالصلاحية) نرفض الطلب أيضاً
        // (Fail-closed) لأن هذه مسارات حساسة، بعكس المسارات العامة الأخرى.
        return res.status(500).json({ success: false, error: 'تعذر التحقق من صلاحية المشرف.' });
    }
}

// 1. جلب جميع المستخدمين مع خيارات البحث والتصفية
app.get('/api/admin/users', requireAdmin, async (req, res) => {
    try {
        const { search, status_filter, role_filter } = req.query;
        
        let query = `
            SELECT 
                user_id, 
                full_name, 
                email, 
                phone, 
                role, 
                is_active, 
                status, 
                service_layer, 
                feature_id,
                x_coord,
                y_coord,
                created_at,
                request_limit,
                request_limit_period
            FROM public.users
        `;
        
        const conditions = [];
        const params = [];
        let paramIndex = 1;

        // إضافة شرط البحث النصي (الاسم أو البريد أو رقم الجوال)
        if (search && search.trim() !== '') {
            conditions.push(`(
                full_name ILIKE $${paramIndex} OR 
                email ILIKE $${paramIndex} OR 
                phone ILIKE $${paramIndex}
            )`);
            params.push(`%${search.trim()}%`);
            paramIndex++;
        }

        // إضافة شرط حالة الاتصال (متصل/غير متصل)
        if (status_filter === 'online') {
            const onlineUserIds = Array.from(connectedUsers.keys());
            if (onlineUserIds.length > 0) {
                conditions.push(`user_id = ANY($${paramIndex})`);
                params.push(onlineUserIds);
                paramIndex++;
            } else {
                // إذا لم يكن هناك متصلين، نرجع قائمة فارغة
                return res.json({
                    success: true,
                    users: [],
                    onlineUserIds: [],
                    total: 0
                });
            }
        } else if (status_filter === 'offline') {
            const onlineUserIds = Array.from(connectedUsers.keys());
            if (onlineUserIds.length > 0) {
                conditions.push(`user_id != ALL($${paramIndex})`);
                params.push(onlineUserIds);
                paramIndex++;
            }
        }

        // إضافة شرط نوع المستخدم (دور المستخدم)
        if (role_filter && role_filter !== 'all') {
            conditions.push(`role = $${paramIndex}`);
            params.push(role_filter);
            paramIndex++;
        }

        // إضافة الشروط إلى الاستعلام
        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY user_id ASC';

        const result = await servicesPool.query(query, params);

        // إضافة حالة الاتصال لكل مستخدم
        const onlineUserIds = Array.from(connectedUsers.keys()).map(id => String(id));
        const usersWithStatus = result.rows.map(user => ({
            ...user,
            is_online: onlineUserIds.includes(String(user.user_id))
        }));

        res.json({
            success: true,
            users: usersWithStatus,
            onlineUserIds: onlineUserIds,
            total: usersWithStatus.length
        });
    } catch (error) {
        console.error('❌ خطأ في جلب المستخدمين:', error.message);
        res.status(500).json({ success: false, error: 'فشل جلب المستخدمين', details: error.message });
    }
});

// 1-أ. جلب قائمة معرّفات المستخدمين المتصلين حالياً فقط (لتحديث سريع دوري بدون إعادة جلب كل الجدول)
app.get('/api/admin/online-users', requireAdmin, (req, res) => {
    try {
        const onlineUserIds = Array.from(connectedUsers.keys()).map(id => String(id));
        res.json({ success: true, onlineUserIds });
    } catch (error) {
        console.error('❌ خطأ في جلب حالة الاتصال:', error.message);
        res.status(500).json({ success: false, error: 'فشل جلب حالة الاتصال', details: error.message });
    }
});

// 1-ب. تسجيل خروج فوري لمستخدم محدد من قبل المشرف + إشعاره فوراً
app.post('/api/admin/users/force-logout', requireAdmin, async (req, res) => {
    const { user_id } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب' });
    }

    try {
        const checkUser = await servicesPool.query('SELECT user_id, full_name FROM public.users WHERE user_id = $1', [user_id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const title = '🚨 تسجيل خروج إجباري من الإدارة';
        const message = 'تم تسجيل خروجك فوراً من قبل الإدارة. يرجى التواصل مع الإدارة حالاً لحل مشكلة الحظر قبل محاولة الدخول مجدداً.';

        // 🆕 [إصلاح الثغرة]: تفعيل علامة إبطال الجلسة فعلياً في قاعدة البيانات.
        // هذا يضمن أن المستخدم لن يستطيع الدخول تلقائياً بجلسته المحفوظة محلياً
        // حتى لو كان غير متصل الآن، لأن /api/auth/verify-session سيرفض جلسته
        // في المرة القادمة التي يفتح فيها الصفحة.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = true WHERE user_id = $1', [user_id]);

        // حفظ الإشعار بقاعدة البيانات (يظهر له لاحقاً حتى لو كان غير متصل الآن)
        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, 'error', false, NOW())`,
            [user_id, title, message]
        );

        // إخراجه فوراً إن كان متصلاً حالياً عبر Socket.io
        const targetSocketId = connectedUsers.get(user_id) || connectedUsers.get(String(user_id)) || connectedUsers.get(Number(user_id));
        let wasOnline = false;
        if (targetSocketId && global.io) {
            global.io.to(targetSocketId).emit('force_relogin', { message });
            wasOnline = true;
            console.log(`🚨 تم تسجيل خروج إجباري فوري للمستخدم ${user_id}`);
        } else {
            console.log(`💤 المستخدم ${user_id} غير متصل حالياً، سيصله الإشعار عند دخوله القادم وسيُمنع دخوله التلقائي فوراً`);
        }

        res.json({
            success: true,
            message: wasOnline
                ? 'تم تسجيل خروج المستخدم فوراً وإرسال التنبيه بنجاح'
                : 'المستخدم غير متصل حالياً، لكن تم إبطال جلسته فعلياً وسيُمنع من الدخول التلقائي في المرة القادمة',
            wasOnline
        });
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج الإجباري:', error.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ تسجيل الخروج الإجباري', details: error.message });
    }
});

// 1-ج. تسجيل خروج جماعي لجميع المستخدمين (متصلين وغير متصلين)
app.post('/api/admin/users/force-logout-all', requireAdmin, async (req, res) => {
    const { target_type, user_ids } = req.body; // target_type: 'all', 'online', 'offline', 'selected'

    try {
        let targetUsers = [];
        let title = '🚨 تسجيل خروج جماعي من الإدارة';
        let message = 'تم تسجيل خروجك من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';

        // تحديد المستخدمين المستهدفين حسب نوع الاستهداف
        switch (target_type) {
            case 'all':
                // جميع المستخدمين
                const allUsersQuery = `SELECT user_id FROM public.users`;
                const allUsersResult = await servicesPool.query(allUsersQuery);
                targetUsers = allUsersResult.rows.map(row => row.user_id);
                message = 'تم تسجيل خروج جميع المستخدمين من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';
                break;

            case 'online':
                // المستخدمين المتصلين حالياً فقط
                targetUsers = Array.from(connectedUsers.keys()).map(id => Number(id));
                message = 'تم تسجيل خروج جميع المستخدمين المتصلين حالياً من قبل الإدارة.';
                break;

            case 'offline':
                // المستخدمين غير المتصلين
                const onlineUserIds = Array.from(connectedUsers.keys()).map(id => Number(id));
                const offlineUsersQuery = `SELECT user_id FROM public.users WHERE user_id != ALL($1)`;
                const offlineUsersResult = await servicesPool.query(offlineUsersQuery, [onlineUserIds.length > 0 ? onlineUserIds : [0]]);
                targetUsers = offlineUsersResult.rows.map(row => row.user_id);
                message = 'تم تسجيل خروج جميع المستخدمين غير المتصلين من قبل الإدارة.';
                break;

            case 'selected':
                // مستخدمين محددين
                if (!user_ids || user_ids.length === 0) {
                    return res.status(400).json({ success: false, error: 'يجب اختيار مستخدم واحد على الأقل' });
                }
                targetUsers = user_ids.map(id => Number(id));
                message = 'تم تسجيل خروجك من قبل الإدارة. يرجى إعادة تسجيل الدخول للمتابعة.';
                break;

            default:
                return res.status(400).json({ success: false, error: 'نوع استهداف غير صالح' });
        }

        if (targetUsers.length === 0) {
            return res.status(400).json({ success: false, error: 'لا يوجد مستخدمين مستهدفين' });
        }

        // 🆕 [إصلاح الثغرة]: تفعيل علامة إبطال الجلسة دفعة واحدة لكل المستخدمين
        // المستهدفين، بغض النظر عن كونهم متصلين الآن أم لا. هذا يمنعهم من
        // الدخول التلقائي بجلسة محفوظة قديمة عبر /api/auth/verify-session.
        await servicesPool.query('UPDATE public.users SET force_logout_flag = true WHERE user_id = ANY($1)', [targetUsers]);

        let onlineCount = 0;
        let offlineCount = 0;

        // إرسال الإشعارات وتسجيل الخروج لكل مستخدم
        for (const userId of targetUsers) {
            try {
                // حفظ الإشعار في قاعدة البيانات
                await servicesPool.query(
                    `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                     VALUES ($1, $2, $3, 'error', false, NOW())`,
                    [userId, title, message]
                );

                // إخراجه فوراً إن كان متصلاً حالياً عبر Socket.io
                const targetSocketId = connectedUsers.get(userId) || connectedUsers.get(String(userId)) || connectedUsers.get(Number(userId));
                if (targetSocketId && global.io) {
                    global.io.to(targetSocketId).emit('force_relogin', { message });
                    onlineCount++;
                    console.log(`🚨 تم تسجيل خروج فوري للمستخدم ${userId}`);
                } else {
                    offlineCount++;
                    console.log(`💤 المستخدم ${userId} غير متصل، تم حفظ الإشعار وإبطال جلسته المحفوظة`);
                }
            } catch (err) {
                console.error(`❌ خطأ في تسجيل خروج المستخدم ${userId}:`, err.message);
            }
        }

        res.json({
            success: true,
            message: `تم تسجيل خروج ${targetUsers.length} مستخدم (${onlineCount} متصل، ${offlineCount} غير متصل) وإبطال جلساتهم فعلياً`,
            total: targetUsers.length,
            online: onlineCount,
            offline: offlineCount
        });
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج الجماعي:', error.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ تسجيل الخروج الجماعي', details: error.message });
    }
});

// 2. تحديث بيانات مستخدم (تفعيل، تغيير الدور، ربط مزود خدمة، تغيير كلمة المرور)
app.post('/api/admin/users/update', requireAdmin, async (req, res) => {
    const { user_id, role, is_active, service_layer, feature_id, new_password, request_limit, request_limit_period } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم (user_id) مطلوب' });
    }

    try {
        // التحقق من وجود المستخدم
        const checkUser = await servicesPool.query('SELECT user_id, role FROM public.users WHERE user_id = $1', [user_id]);
        if (checkUser.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'المستخدم غير موجود' });
        }

        const currentUser = checkUser.rows[0];
        const updateFields = [];
        const updateValues = [];
        let idx = 1;

        // تحديث role (نوع الحساب)
        if (role !== undefined) {
            const validRoles = ['user', 'provider', 'admin'];
            const normalizedRole = String(role).toLowerCase().trim();
            if (validRoles.includes(normalizedRole)) {
                updateFields.push(`role = $${idx++}`);
                updateValues.push(normalizedRole);
            }
        }

        // تحديث is_active (تفعيل/تعطيل الحساب)
        if (is_active !== undefined) {
            updateFields.push(`is_active = $${idx++}`);
            updateValues.push(is_active === true);
        }

        // تحديث service_layer (ربط مزود خدمة)
        if (service_layer !== undefined) {
            updateFields.push(`service_layer = $${idx++}`);
            updateValues.push(service_layer && service_layer.trim() !== '' ? service_layer.trim() : null);
        }

        // تحديث feature_id
        if (feature_id !== undefined) {
            updateFields.push(`feature_id = $${idx++}`);
            updateValues.push(feature_id ? parseInt(feature_id) : null);
        }

        // تحديث كلمة المرور (مشفّرة دائماً بـ bcrypt، وليس كنص صريح)
        if (new_password && new_password.trim().length >= 6) {
            const hashedAdminSetPassword = await bcrypt.hash(new_password.trim(), BCRYPT_SALT_ROUNDS);
            updateFields.push(`password_hash = $${idx++}`);
            updateValues.push(hashedAdminSetPassword);
        }

        // تحديث حد الطلبات/الأحداث (اتركه فارغاً = مفتوح بدون حد - وهو الوضع الافتراضي)
        if (request_limit !== undefined) {
            const parsedLimit = (request_limit === null || request_limit === '') ? null : parseInt(request_limit, 10);
            updateFields.push(`request_limit = $${idx++}`);
            updateValues.push((parsedLimit && parsedLimit > 0) ? parsedLimit : null);
        }

        // تحديث نوع فترة حد الطلبات (يومي / أسبوعي / شهري)
        if (request_limit_period !== undefined) {
            const validPeriods = ['daily', 'weekly', 'monthly'];
            const normalizedPeriod = validPeriods.includes(request_limit_period) ? request_limit_period : 'daily';
            updateFields.push(`request_limit_period = $${idx++}`);
            updateValues.push(normalizedPeriod);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({ success: false, error: 'لا توجد تغييرات للحفظ' });
        }

        // بناء وتنفيذ الاستعلام النهائي
        const finalQuery = `UPDATE public.users SET ${updateFields.join(', ')} WHERE user_id = $${idx}`;
        updateValues.push(user_id);

        await servicesPool.query(finalQuery, updateValues);

        console.log(`✅ تم تحديث المستخدم ${user_id} بنجاح`);

        // 🔔 إرسال إشعار فوري للمستخدم عبر Socket.io أنه تم تغيير بياناته ويجب إعادة تسجيل الدخول
        try {
            // حفظ إشعار في قاعدة البيانات
            const notifQuery = `
                INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                VALUES ($1, $2, $3, 'warning', false, NOW())
            `;
            await servicesPool.query(notifQuery, [
                user_id,
                '⚠️ تم تحديث حسابك من قبل الإدارة',
                'تم تعديل بيانات حسابك (الصلاحيات/الحالة). يرجى تسجيل الخروج ثم إعادة تسجيل الدخول لتطبيق التغييرات.'
            ]);

            // إرسال أمر force_relogin عبر Socket.io إذا كان المستخدم متصلاً
            const targetSocketId = connectedUsers.get(user_id);
            if (targetSocketId && global.io) {
                global.io.to(targetSocketId).emit('force_relogin', {
                    message: 'تم تحديث حسابك من قبل الإدارة. يرجى تسجيل الخروج ثم إعادة تسجيل الدخول لتطبيق التغييرات.'
                });
                console.log(`📡 تم إرسال أمر force_relogin للمستخدم ${user_id}`);
            } else {
                console.log(`💤 المستخدم ${user_id} غير متصل حالياً، تم حفظ الإشعار فقط`);
            }
        } catch (notifErr) {
            console.error(`⚠️ فشل إرسال إشعار التحديث للمستخدم ${user_id}:`, notifErr.message);
        }

        res.json({
            success: true,
            message: 'تم تحديث بيانات المستخدم بنجاح'
        });

    } catch (error) {
        console.error('❌ خطأ في تحديث المستخدم:', error.message);
        res.status(500).json({ success: false, error: 'فشل تحديث بيانات المستخدم', details: error.message });
    }
});
// =========================================================================
// 🆕 نظام طلب الخدمة + الدردشة + تسجيل عمليات النجاح (Backend Server)
// =========================================================================

// دالة مساعدة: جلب سوكيت المستخدم المتصل حالياً (إن وجد) من نفس خريطة connectedUsers
function getSocketIdForUser(userId) {
    return connectedUsers.get(userId) || connectedUsers.get(String(userId)) || connectedUsers.get(Number(userId));
}

// 🆕 استخراج رقم محلي من رقم واتساب دولي (00970598512667 -> 0598512667)
// نفس المنطق المستخدم بالضبط في popup.js و service-chat.js لضمان التطابق
function deriveLocalPhoneFromWhatsapp(rawWhatsapp) {
    if (!rawWhatsapp) return null;
    const digits = String(rawWhatsapp).replace(/\D/g, '');
    if (digits.length <= 5) return digits || null; // رقم قصير جداً، أعده كما هو تحسباً
    return '0' + digits.slice(5);
}

// 🆕 جلب بيانات تواصل مزود الخدمة (هاتف + واتساب) من جدول طبقة الخدمة نفسها
// (مثلاً public."electrician")، وليس من جدول users نهائياً - لأن جدول users
// لا يملك عمود whatsapp أصلاً، وبيانات التواصل الحقيقية لمزود الخدمة مخزنة
// بجدول الطبقة الجغرافية المرتبط بها (service_layer + feature_id).
async function getProviderContactInfo(serviceLayer, featureId) {
    if (!serviceLayer || !featureId || !isValidLayer(serviceLayer)) {
        return { whatsapp: null, phone: null };
    }
    try {
        const targetPool = getPoolForLayer(serviceLayer);
        const result = await targetPool.query(
            `SELECT whatsapp, phone FROM public."${serviceLayer}" WHERE id = $1 LIMIT 1`,
            [featureId]
        );
        if (result.rows.length === 0) return { whatsapp: null, phone: null };

        const rawWhatsapp = result.rows[0].whatsapp ? String(result.rows[0].whatsapp).trim() : null;
        const rawPhone = result.rows[0].phone ? String(result.rows[0].phone).trim() : null;
        return { whatsapp: rawWhatsapp, phone: rawPhone };
    } catch (err) {
        console.error(`⚠️ خطأ أثناء جلب بيانات تواصل مزود الخدمة من طبقة [${serviceLayer}]:`, err.message);
        return { whatsapp: null, phone: null };
    }
}

// 1) إنشاء طلب خدمة جديد (المستخدم يضغط "طلب الخدمة" بالبوب أب)
app.post('/api/service-requests', async (req, res) => {
    const { user_id, service_layer, feature_id, provider_name, service_type } = req.body;

    if (!user_id || !service_layer || !feature_id) {
        return res.status(400).json({ success: false, error: 'بيانات الطلب غير مكتملة.' });
    }
    if (!isValidLayer(service_layer)) {
        return res.status(403).json({ success: false, error: 'طبقة خدمة غير صالحة.' });
    }

    try {
        const providerResult = await servicesPool.query(
            `SELECT user_id, full_name, phone
             FROM public.users
             WHERE role = 'provider' AND service_layer = $1 AND feature_id = $2 LIMIT 1`,
            [service_layer, feature_id]
        );

        if (providerResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'تعذر العثور على حساب مزود الخدمة المرتبط بهذا المعلم.' });
        }

        const provider = providerResult.rows[0];

        if (Number(provider.user_id) === Number(user_id)) {
            return res.status(400).json({ success: false, error: 'لا يمكنك إرسال طلب خدمة لنفسك.' });
        }

        const insertResult = await servicesPool.query(
            `INSERT INTO public.service_requests (user_id, provider_user_id, service_layer, feature_id, provider_name, service_type)
             VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, status, created_at`,
            [user_id, provider.user_id, service_layer, feature_id, provider_name || provider.full_name, service_type || service_layer]
        );

        const newRequest = insertResult.rows[0];

        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, 'info', false, NOW())`,
            [provider.user_id, '📩 طلب خدمة جديد', `لديك طلب خدمة جديد (${service_type || service_layer}). يرجى فتح التطبيق للرد عليه.`]
        );

        const providerSocketId = getSocketIdForUser(provider.user_id);
        console.log('📡 [NEW REQUEST] Provider ID:', provider.user_id, 'Socket ID:', providerSocketId);
        if (providerSocketId && global.io) {
            console.log('📡 [NEW REQUEST] Emitting service_request_new to socket:', providerSocketId);
            global.io.to(providerSocketId).emit('service_request_new', {
                id: newRequest.id,
                requestId: newRequest.id,
                serviceType: service_type || service_layer,
                createdAt: newRequest.created_at
            });
        } else {
            console.log('⚠️ [NEW REQUEST] Provider not connected via socket');
        }

        res.json({ success: true, requestId: newRequest.id, status: newRequest.status });
    } catch (err) {
        console.error('❌ خطأ أثناء إنشاء طلب الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل إنشاء طلب الخدمة', details: err.message });
    }
});

// 2) جلب الطلبات النشطة (المرسلة أو المستلمة) لمستخدم معين
app.get('/api/service-requests', async (req, res) => {
    const { user_id, provider_user_id, status } = req.query;

    if (!user_id && !provider_user_id) {
        return res.status(400).json({ success: false, error: 'user_id أو provider_user_id مطلوب' });
    }

    try {
        let query = `
            SELECT sr.*,
                   ru.full_name AS requester_name, ru.phone AS requester_phone, ru.whatsapp_number AS requester_whatsapp,
                   pu.full_name AS provider_full_name, pu.phone AS provider_phone, pu.whatsapp_number AS provider_whatsapp
            FROM public.service_requests sr
            LEFT JOIN public.users ru ON ru.user_id = sr.user_id
            LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
            WHERE 1=1
        `;
        let params = [];
        let paramIndex = 1;

        if (provider_user_id) {
            query += ` AND sr.provider_user_id = $${paramIndex++}`;
            params.push(provider_user_id);
        } 
        
        if (user_id && !provider_user_id) {
            query += ` AND (sr.user_id = $${paramIndex++} OR sr.provider_user_id = $${paramIndex++})`;
            params.push(user_id, user_id);
        }

        if (status) {
            query += ` AND sr.status = $${paramIndex++}`;
            params.push(status);
        } else if (!provider_user_id) {
            query += ` AND sr.status IN ('pending', 'accepted', 'completed', 'cancelled', 'rejected')`;
        }

        query += ` ORDER BY sr.created_at DESC`;

        const result = await servicesPool.query(query, params);
        const requests = result.rows;

        // 🆕 تجهيز أرقام التواصل الصحيحة فقط للطلبات المكتملة (بعد "تم الاتفاق"):
        // - رقم هاتف المستخدم الطالب: من عمود phone بجدول users كما هو تماماً.
        // - رقم واتساب المستخدم الطالب: من عمود whatsapp_number بجدول users.
        // - رقم هاتف وواتساب مزود الخدمة: من جدول طبقة الخدمة نفسها (عمود whatsapp)
        await Promise.all(requests.map(async (r) => {
            if (r.status === 'completed') {
                const providerContact = await getProviderContactInfo(r.service_layer, r.feature_id);
                r.userPhone = r.requester_phone || null;
                r.userWhatsapp = r.requester_whatsapp || null;
                r.providerPhone = providerContact.phone;
                r.providerWhatsapp = providerContact.whatsapp;
            }
            // 🆕 اسم الطرف الآخر بشكل موحّد لواجهة "طلباتي النشطة"
            r.user_name = r.requester_name;
        }));

        res.json({ success: true, requests });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب طلبات الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات', details: err.message });
    }
});

// 3) رد مزود الخدمة على الطلب (قبول / رفض)
app.post('/api/service-requests/:id/respond', async (req, res) => {
    const { id } = req.params;
    const { provider_user_id, action } = req.body;

    if (!provider_user_id || !['accept', 'reject'].includes(action)) {
        return res.status(400).json({ success: false, error: 'بيانات الرد غير صالحة.' });
    }

    try {
        const reqResult = await servicesPool.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });

        const request = reqResult.rows[0];
        if (Number(request.provider_user_id) !== Number(provider_user_id)) {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية الرد على هذا الطلب.' });
        }
        if (request.status !== 'pending') {
            return res.status(400).json({ success: false, error: 'تم الرد على هذا الطلب مسبقاً.' });
        }

        const newStatus = action === 'accept' ? 'accepted' : 'rejected';
        await servicesPool.query('UPDATE public.service_requests SET status = $1, updated_at = NOW() WHERE id = $2', [newStatus, id]);

        const title = action === 'accept' ? '✅ تم قبول طلبك' : '❌ تم رفض طلبك';
        const message = action === 'accept'
            ? `وافق مزود الخدمة على طلبك (${request.service_type}). يمكنك الآن الدردشة معه.`
            : `اعتذر مزود الخدمة عن طلبك (${request.service_type}).`;

        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
             VALUES ($1, $2, $3, $4, false, NOW())`,
            [request.user_id, title, message, action === 'accept' ? 'success' : 'error']
        );

        const userSocketId = getSocketIdForUser(request.user_id);
        console.log('📡 [RESPONSE] User ID:', request.user_id, 'Socket ID:', userSocketId);
        if (userSocketId && global.io) {
            console.log('📡 [RESPONSE] Emitting service_request_response to socket:', userSocketId);
            global.io.to(userSocketId).emit('service_request_response', {
                requestId: Number(id),
                status: newStatus,
                serviceType: request.service_type,
                providerName: request.provider_name
            });
        } else {
            console.log('⚠️ [RESPONSE] User not connected via socket');
        }

        res.json({ success: true, status: newStatus });
    } catch (err) {
        console.error('❌ خطأ أثناء الرد على طلب الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ الرد', details: err.message });
    }
});

// 🆕 3 مكرر) إلغاء الطلب من قبل المستخدم أو المزود
app.post('/api/service-requests/:id/cancel', async (req, res) => {
    const requestId = req.params.id;
    const { user_id, cancellation_reason } = req.body; 

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب' });
    }

    try {
        const reqCheck = await servicesPool.query(
            `SELECT * FROM public.service_requests WHERE id = $1`,
            [requestId]
        );

        if (reqCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const sRequest = reqCheck.rows[0];
        const isOwner = String(sRequest.user_id) === String(user_id);
        const isProvider = String(sRequest.provider_user_id) === String(user_id);

        if (!isOwner && !isProvider) {
            return res.status(403).json({ success: false, error: 'عذراً، ليس لديك صلاحية إلغاء هذا الطلب.' });
        }

        const reasonText = cancellation_reason ? String(cancellation_reason).trim() : 'تم الإلغاء بدون ذكر أسباب';

        const updateRes = await servicesPool.query(
            `UPDATE public.service_requests 
             SET status = 'cancelled', cancellation_reason = $1, updated_at = NOW() 
             WHERE id = $2 RETURNING *`,
            [reasonText, requestId]
        );

        const targetUserId = isOwner ? sRequest.provider_user_id : sRequest.user_id;
        await servicesPool.query(
            `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
             VALUES ($1, '⚠️ تم إلغاء الطلب', $2, 'error', false, NOW())`,
            [targetUserId, `تم إلغاء الطلب والسبب: ${reasonText}`]
        );

        const targetSocketId = getSocketIdForUser(targetUserId);
        if (targetSocketId && global.io) {
            global.io.to(targetSocketId).emit('service_request_cancelled', { 
                requestId: Number(requestId), 
                reason: reasonText 
            });
        }

        res.json({ success: true, request: updateRes.rows[0] });
    } catch (err) {
        console.error('❌ خطأ أثناء إلغاء الطلب:', err.message);
        res.status(500).json({ success: false, error: 'تعذر إلغاء الطلب', details: err.message });
    }
});

// مسار جلب كافة السجلات والطلبات بشكل تفصيلي لوحة التحكم
app.get('/api/admin/all-service-requests-logs', requireAdmin, async (req, res) => {
    try {
        const result = await servicesPool.query(`
            SELECT sr.id, sr.user_id, sr.provider_user_id, sr.service_layer, sr.feature_id,
                   sr.service_type, sr.status, sr.cancellation_reason, sr.created_at, sr.updated_at,
                   ru.full_name AS requester_name, ru.phone AS requester_phone, ru.whatsapp_number AS requester_whatsapp,
                   pu.full_name AS provider_name, pu.phone AS provider_phone, pu.whatsapp_number AS provider_whatsapp
            FROM public.service_requests sr
            LEFT JOIN public.users ru ON ru.user_id = sr.user_id
            LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
            ORDER BY sr.created_at DESC
        `);
        res.json({ success: true, logs: result.rows });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب سجلات الطلبات التفصيلية:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب السجلات', details: err.message });
    }
});

// 4) جلب رسائل الدردشة الخاصة بطلب معيّن + بيانات التواصل عند اكتمال الاتفاق
app.get('/api/service-requests/:id/messages', async (req, res) => {
    const { id } = req.params;
    try {
        const messagesResult = await servicesPool.query(
            'SELECT * FROM public.service_request_messages WHERE request_id = $1 ORDER BY created_at ASC',
            [id]
        );

        const requestResult = await servicesPool.query(
            'SELECT * FROM public.service_requests WHERE id = $1',
            [id]
        );

        if (requestResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'الطلب غير موجود' });
        }

        const request = requestResult.rows[0];
        const responsePayload = {
            success: true,
            messages: messagesResult.rows,
            requestStatus: request.status
        };

        if (request.status === 'completed') {
            // 🆕 استخدام phone و whatsapp_number من جدول users
            const userContactResult = await servicesPool.query(
                'SELECT phone, whatsapp_number FROM public.users WHERE user_id = $1',
                [request.user_id]
            );
            const userPhone = userContactResult.rows[0]?.phone || null;
            const userWhatsapp = userContactResult.rows[0]?.whatsapp_number || null;
            const providerContact = await getProviderContactInfo(request.service_layer, request.feature_id);

            responsePayload.userPhone = userPhone;
            responsePayload.userWhatsapp = userWhatsapp;
            responsePayload.providerPhone = providerContact.phone;
            responsePayload.providerWhatsapp = providerContact.whatsapp;
        }

        res.json(responsePayload);
    } catch (err) {
        res.status(500).json({ success: false, error: 'فشل جلب الرسائل', details: err.message });
    }
});
// 5) إرسال رسالة دردشة جديدة ضمن طلب مقبول
app.post('/api/service-requests/:id/message', async (req, res) => {
    const { id } = req.params;
    const { sender_role, sender_id, message } = req.body;

    if (!sender_id || !message || !['user', 'provider'].includes(sender_role)) {
        return res.status(400).json({ success: false, error: 'بيانات الرسالة غير مكتملة.' });
    }

    const trimmedMsg = String(message).trim();
    if (trimmedMsg === '') {
        return res.status(400).json({ success: false, error: 'لا يمكن إرسال رسالة فارغة.' });
    }

    try {
        const reqResult = await servicesPool.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        const request = reqResult.rows[0];

        if (request.status !== 'accepted') {
            return res.status(400).json({ success: false, error: 'الدردشة متاحة فقط بعد قبول الطلب.' });
        }

        const senderIdInRequest = sender_role === 'user' ? request.user_id : request.provider_user_id;
        if (Number(senderIdInRequest) !== Number(sender_id)) {
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية إرسال رسالة بهذه المحادثة.' });
        }

        const insertResult = await servicesPool.query(
            `INSERT INTO public.service_request_messages (request_id, sender_role, sender_id, message)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [id, sender_role, sender_id, trimmedMsg.slice(0, 1000)]
        );
        const savedMessage = insertResult.rows[0];

        const otherUserId = sender_role === 'user' ? request.provider_user_id : request.user_id;
        const otherSocketId = getSocketIdForUser(otherUserId);
        if (otherSocketId && global.io) {
            global.io.to(otherSocketId).emit('service_request_message', { requestId: Number(id), message: savedMessage });
        }

        res.json({ success: true, message: savedMessage });
    } catch (err) {
        console.error('❌ خطأ أثناء إرسال رسالة الدردشة:', err.message);
        res.status(500).json({ success: false, error: 'فشل إرسال الرسالة', details: err.message });
    }
});

// 6) تأكيد الاتفاق من أحد الطرفين
app.post('/api/service-requests/:id/confirm', async (req, res) => {
    const { id } = req.params;
    const { role, user_id } = req.body;

    if (!user_id || !['user', 'provider'].includes(role)) {
        return res.status(400).json({ success: false, error: 'بيانات التأكيد غير صالحة.' });
    }

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');

        const reqResult = await client.query('SELECT * FROM public.service_requests WHERE id = $1 FOR UPDATE', [id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'accepted' && request.status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لا يمكن التأكيد قبل قبول الطلب.' });
        }

        const expectedId = role === 'user' ? request.user_id : request.provider_user_id;
        if (Number(expectedId) !== Number(user_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'لا تملك صلاحية التأكيد على هذا الطلب.' });
        }

        const fieldToUpdate = role === 'user' ? 'user_confirmed' : 'provider_confirmed';
        await client.query(`UPDATE public.service_requests SET ${fieldToUpdate} = true, updated_at = NOW() WHERE id = $1`, [id]);

        const refreshed = (await client.query('SELECT * FROM public.service_requests WHERE id = $1', [id])).rows[0];

        if (refreshed.user_confirmed && refreshed.provider_confirmed && refreshed.status !== 'completed') {
            await client.query(`UPDATE public.service_requests SET status = 'completed', updated_at = NOW() WHERE id = $1`, [id]);
            await client.query('COMMIT');

            // 🆕 هاتف المستخدم الطالب من عمود phone بجدول users
            const userContactResult = await servicesPool.query(
                'SELECT phone, whatsapp_number FROM public.users WHERE user_id = $1',
                [refreshed.user_id]
            );
            const userPhone = userContactResult.rows[0]?.phone || null;
            const userWhatsapp = userContactResult.rows[0]?.whatsapp_number || null;

            // 🆕 هاتف وواتساب مزود الخدمة من جدول طبقة الخدمة نفسها (عمود whatsapp)
            const providerContact = await getProviderContactInfo(refreshed.service_layer, refreshed.feature_id);

            const payloadForUser = {
                requestId: Number(id),
                userPhone: userPhone,
                userWhatsapp: userWhatsapp,
                providerPhone: providerContact.phone,
                providerWhatsapp: providerContact.whatsapp 
            };
            const payloadForProvider = {
                requestId: Number(id),
                userPhone: userPhone,
                userWhatsapp: userWhatsapp
            };

            const userSocketId = getSocketIdForUser(refreshed.user_id);
            if (userSocketId && global.io) global.io.to(userSocketId).emit('service_request_completed', payloadForUser);

            const providerSocketId = getSocketIdForUser(refreshed.provider_user_id);
            if (providerSocketId && global.io) global.io.to(providerSocketId).emit('service_request_completed', payloadForProvider);

            await servicesPool.query(
                `INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                 VALUES ($1, '🎉 تم الاتفاق بنجاح', 'تم تبادل أرقام التواصل، بالتوفيق!', 'success', false, NOW()),
                       ($2, '🎉 تم الاتفاق بنجاح', 'تم تبادل أرقام التواصل، بالتوفيق!', 'success', false, NOW())`,
                [refreshed.user_id, refreshed.provider_user_id]
            );

            return res.json({ 
                success: true, 
                status: 'completed', 
                userPhone: userPhone, 
                userWhatsapp: userPhone,
                providerPhone: providerContact.phone,
                providerWhatsapp: providerContact.whatsapp 
            });
        }

        await client.query('COMMIT');
        res.json({ success: true, status: refreshed.status, waitingOtherSide: true });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء تأكيد طلب الخدمة:', err.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ التأكيد', details: err.message });
    } finally {
        client.release();
    }
});

// 8) إرسال تقييم وتعليق على مزود خدمة بعد اكتمال الاتفاق
app.post('/api/service-requests/:id/rating', async (req, res) => {
    const { id } = req.params;
    const { user_id, rating, comment } = req.body;

    if (!user_id || !rating || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'بيانات التقييم غير صالحة.' });
    }

    // التعليق اختياري الآن
    const commentValue = (comment && comment.trim() !== '') ? comment.trim() : null;

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');

        // التحقق من وجود الطلب وأنه مكتمل
        const reqResult = await client.query('SELECT * FROM public.service_requests WHERE id = $1', [id]);
        if (reqResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'الطلب غير موجود.' });
        }
        const request = reqResult.rows[0];

        if (request.status !== 'completed') {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'يمكن التقييم فقط بعد اكتمال الاتفاق.' });
        }

        // التحقق من أن المستخدم هو الطالب (ليس المزود)
        if (Number(request.user_id) !== Number(user_id)) {
            await client.query('ROLLBACK');
            return res.status(403).json({ success: false, error: 'يمكن للمستخدم الطالب فقط تقييم الخدمة.' });
        }

        // التحقق من عدم وجود تقييم سابق
        const existingRating = await client.query(
            'SELECT id FROM public.service_ratings WHERE request_id = $1 AND user_id = $2',
            [id, user_id]
        );
        if (existingRating.rows.length > 0) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لقد قمت بتقييم هذه الخدمة مسبقاً.' });
        }

        // إدراج التقييم (التعليق اختياري)
        await client.query(
            `INSERT INTO public.service_ratings (request_id, user_id, provider_user_id, service_layer, feature_id, rating, comment, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [id, user_id, request.provider_user_id, request.service_layer, request.feature_id, rating, commentValue]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'تم إرسال التقييم بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء إرسال التقييم:', err.message);
        res.status(500).json({ success: false, error: 'فشل إرسال التقييم', details: err.message });
    } finally {
        client.release();
    }
});

// 9) جلب التقييمات لمزود خدمة معين (معروفاً بـ service_layer و feature_id)
app.get('/api/service-ratings', async (req, res) => {
    const { service_layer, feature_id } = req.query;

    if (!service_layer || !feature_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد service_layer و feature_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.rating, sr.comment, sr.created_at, u.full_name as user_name
             FROM public.service_ratings sr
             LEFT JOIN public.users u ON sr.user_id = u.user_id
             WHERE sr.service_layer = $1 AND sr.feature_id = $2
             ORDER BY sr.created_at DESC`,
            [service_layer, feature_id]
        );

        // حساب المتوسط
        const ratings = result.rows;
        const averageRating = ratings.length > 0 
            ? (ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(1)
            : 0;

        res.json({
            success: true,
            ratings: ratings,
            averageRating: parseFloat(averageRating),
            totalRatings: ratings.length
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب التقييمات:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب التقييمات', details: err.message });
    }
});

// 10) إضافة تعليق لاحقاً على تقييم موجود
app.put('/api/service-ratings/:id/comment', async (req, res) => {
    const { id } = req.params;
    const { user_id, comment } = req.body;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'معرف المستخدم مطلوب.' });
    }

    if (!comment || comment.trim() === '') {
        return res.status(400).json({ success: false, error: 'التعليق مطلوب.' });
    }

    const client = await servicesPool.connect();
    try {
        await client.query('BEGIN');

        // التحقق من وجود التقييم وأنه للمستخدم المحدد
        const ratingResult = await client.query(
            'SELECT * FROM public.service_ratings WHERE id = $1 AND user_id = $2',
            [id, user_id]
        );
        if (ratingResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ success: false, error: 'التقييم غير موجود أو لا تملك صلاحية تعديله.' });
        }

        const rating = ratingResult.rows[0];

        // التحقق من عدم وجود تعليق مسبقاً
        if (rating.comment) {
            await client.query('ROLLBACK');
            return res.status(400).json({ success: false, error: 'لقد قمت بإضافة تعليق مسبقاً.' });
        }

        // تحديث التعليق
        await client.query(
            'UPDATE public.service_ratings SET comment = $1 WHERE id = $2',
            [comment.trim(), id]
        );

        await client.query('COMMIT');
        res.json({ success: true, message: 'تم إضافة التعليق بنجاح.' });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ خطأ أثناء إضافة التعليق:', err.message);
        res.status(500).json({ success: false, error: 'فشل إضافة التعليق', details: err.message });
    } finally {
        client.release();
    }
});

// 11) التحقق من وجود تقييم سابق لمستخدم على طلب معين
app.get('/api/service-requests/:id/rating-check', async (req, res) => {
    const { id } = req.params;
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        const result = await servicesPool.query(
            'SELECT id, comment FROM public.service_ratings WHERE request_id = $1 AND user_id = $2',
            [id, user_id]
        );

        res.json({
            success: true,
            hasRated: result.rows.length > 0,
            hasComment: result.rows.length > 0 && result.rows[0].comment !== null,
            ratingId: result.rows.length > 0 ? result.rows[0].id : null
        });
    } catch (err) {
        console.error('❌ خطأ أثناء التحقق من التقييم:', err.message);
        res.status(500).json({ success: false, error: 'فشل التحقق من التقييم', details: err.message });
    }
});

// 12) جلب التقييمات التي تنقصها تعليق لمستخدم معين
app.get('/api/service-ratings/pending-comments', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.id, sr.request_id, sr.service_layer, sr.feature_id, sr.rating, sr.created_at,
                    sr.provider_user_id, u.full_name as provider_name
             FROM public.service_ratings sr
             LEFT JOIN public.users u ON sr.provider_user_id = u.user_id
             WHERE sr.user_id = $1 AND (sr.comment IS NULL OR sr.comment = '')
             ORDER BY sr.created_at DESC`,
            [user_id]
        );

        res.json({
            success: true,
            pendingComments: result.rows
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب التقييمات التي تنقصها تعليق:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب التقييمات', details: err.message });
    }
});

// 13) جلب الطلبات المكتملة التي لم يتم تقييمها لمستخدم معين
app.get('/api/service-requests/pending-ratings', async (req, res) => {
    const { user_id } = req.query;

    if (!user_id) {
        return res.status(400).json({ success: false, error: 'يجب تحديد user_id.' });
    }

    try {
        const result = await servicesPool.query(
            `SELECT sr.id, sr.service_type, sr.provider_user_id, u.full_name as provider_name
             FROM public.service_requests sr
             LEFT JOIN public.users u ON sr.provider_user_id = u.user_id
             WHERE sr.user_id = $1 AND sr.status = 'completed'
             AND sr.id NOT IN (SELECT request_id FROM public.service_ratings WHERE user_id = $1)
             ORDER BY sr.updated_at DESC`,
            [user_id]
        );

        res.json({
            success: true,
            pendingRatings: result.rows
        });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب الطلبات المكتملة التي لم يتم تقييمها:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الطلبات', details: err.message });
    }
});

// 7) إحصائية عدد عمليات النجاح لكل مزود خدمة
app.get('/api/admin/provider-success-stats', requireAdmin, async (req, res) => {
    try {
        const result = await servicesPool.query(`
            SELECT sr.*, 
                   ru.full_name AS username, ru.phone AS requester_phone, COALESCE(ru.phone, '') AS requester_whatsapp,
                   pu.full_name AS provider_name, pu.phone AS provider_phone, COALESCE(pu.phone, '') AS provider_whatsapp
            FROM public.service_requests sr
            LEFT JOIN public.users ru ON ru.user_id = sr.user_id
            LEFT JOIN public.users pu ON pu.user_id = sr.provider_user_id
            ORDER BY sr.created_at DESC
        `);
        res.json({ success: true, stats: result.rows });
    } catch (err) {
        console.error('❌ خطأ حرج في الـ API:', err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

// 7.1) حذف سجل طلب خدمة (للمشرف فقط)
app.delete('/api/admin/provider-success-stats/:id', requireAdmin, async (req, res) => {
    const { id } = req.params;

    try {
        await servicesPool.query(
            'DELETE FROM public.service_requests WHERE id = $1',
            [id]
        );

        res.json({ success: true, message: 'تم حذف السجل بنجاح' });
    } catch (err) {
        console.error('❌ خطأ في حذف السجل:', err.message);
        res.status(500).json({ success: false, error: 'فشل حذف السجل' });
    }
});

// =========================================================================
// 🆕 [عرض ذكي لأزرار التواصل]: مسار عام يرجع، لكل طبقة خدمة، قائمة أرقام
// المعالم (feature_id) المرتبطة فعلياً بحساب مزود خدمة مُفعّل (role='provider'
// و is_active=true). يُستخدم بالواجهة الأمامية (popup.js، no-map-search.js)
// لتقرير: هل نعرض زر "طلب الخدمة" (عبر نظام الطلب والدردشة الحقيقي)، أم
// نعرض اتصال+واتساب مباشرة كما بالعقارات، لأنه عندها لا يوجد حساب حقيقي
// يستقبل طلبات الدردشة لهذا المعلم تحديداً.
// =========================================================================
app.get('/api/provider-linked-features', async (req, res) => {
    try {
        const result = await servicesPool.query(
            `SELECT service_layer, feature_id
             FROM public.users
             WHERE role = 'provider' AND is_active = true
               AND service_layer IS NOT NULL AND feature_id IS NOT NULL`
        );

        const linked = {};
        result.rows.forEach(row => {
            const layer = row.service_layer.trim();
            if (!linked[layer]) linked[layer] = [];
            linked[layer].push(row.feature_id);
        });

        res.json({ success: true, linked });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب قائمة مزودي الخدمة المرتبطين:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: err.message });
    }
});

// 8. مسار معالجة غير المطابق
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// 9. تقديم الملفات الثابتة
app.use((req, res, next) => {
    const forbiddenPatterns = [
        /^\/server\.js$/i,
        /^\/package(?:-lock)?\.json$/i,
        /^\/\.env/i,
        /^\/\.git(?:\/|$)/i,
        /^\/node_modules(?:\/|$)/i,
        /^\/database(?:\/|$)/i,
        /^\/docs(?:\/|$)/i,
        /^\/GeoServerData(?:\/|$)/i,
        /^\/tools(?:\/|$)/i
    ];
    if (forbiddenPatterns.some((re) => re.test(req.path))) {
        return res.status(404).end();
    }
    next();
});
app.use(express.static(path.join(__dirname), { dotfiles: 'ignore', index: false, redirect: false }));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 10. خطأ عام للميدل وير
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) {
        return next(err);
    }
    res.status(err.status || 500).json({ error: err.message || 'Unhandled server error' });
});


// ==========================================
// Socket.io - نظام الإشعارات في الوقت الفعلي
// ==========================================

// تخزين المستخدمين المتصلين مع معرفاتهم
const connectedUsers = new Map();

io.on('connection', (socket) => {
    console.log(`🔗 مستخدم جديد متصل: ${socket.id}`);

    // عند تسجيل دخول المستخدم، نقوم بربط Socket ID بمعرف المستخدم
    socket.on('user_connected', (userId) => {
        console.log(`👤 المستخدم ${userId} متصل بـ Socket ID: ${socket.id}`);
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;

        // إرسال تأكيد الاتصال للمستخدم
        socket.emit('connection_confirmed', { userId, socketId: socket.id });
    });

    // عند فصل المستخدم
    socket.on('disconnect', () => {
        if (socket.userId) {
            console.log(`🔌 المستخدم ${socket.userId} انقطع اتصاله`);
            connectedUsers.delete(socket.userId);
        }
    });

    // استقبال إشعار من لوحة التحكم وإرساله للمستخدم المستهدف
    socket.on('send_notification', async (data) => {
        console.log('📨 استلام طلب إرسال إشعار:', data);

        const { targetType, targetUserId, targetUserIds, title, message, type } = data;

        if (!title || !message) {
            console.error('❌ بيانات الإشعار غير مكتملة:', { title, message });
            socket.emit('notification_error', { error: 'بيانات الإشعار غير مكتملة' });
            return;
        }

        try {
            let targetUsers = [];
            let sentCount = 0;

            console.log(`🎯 نوع الاستهداف: ${targetType}`);

            // تحديد المستخدمين المستهدفين حسب نوع الاستهداف
            switch (targetType) {
                case 'single':
                    if (!targetUserId) {
                        console.error('❌ معرف المستخدم مطلوب');
                        socket.emit('notification_error', { error: 'معرف المستخدم مطلوب' });
                        return;
                    }
                    targetUsers = [targetUserId];
                    console.log(`👤 مستخدم واحد: ${targetUserId}`);
                    break;

                case 'online':
                    // إرسال للمستخدمين المتصلين حالياً
                    targetUsers = Array.from(connectedUsers.keys());
                    console.log(`📡 إرسال للمتصلين حالياً: ${targetUsers.length} مستخدم`, targetUsers);
                    break;

                case 'all_users':
                    // إرسال لجميع المستخدمين في قاعدة البيانات
                    console.log('🔍 جلب جميع المستخدمين من قاعدة البيانات...');
                    try {
                        const allUsersQuery = `SELECT user_id FROM public.users`;
                        const allUsersResult = await servicesPool.query(allUsersQuery);
                        targetUsers = allUsersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال لجميع المستخدمين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المستخدمين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المستخدمين من قاعدة البيانات' });
                        return;
                    }
                    break;

                case 'regular_users':
                    // إرسال للمستخدمين العاديين فقط
                    console.log('🔍 جلب المستخدمين العاديين...');
                    try {
                        const regularUsersQuery = `SELECT user_id FROM public.users WHERE role = 'user' OR role IS NULL`;
                        const regularUsersResult = await servicesPool.query(regularUsersQuery);
                        targetUsers = regularUsersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال للمستخدمين العاديين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المستخدمين العاديين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المستخدمين العاديين' });
                        return;
                    }
                    break;

                case 'providers':
                    // إرسال لمزودي الخدمات فقط
                    console.log('🔍 جلب مزودي الخدمات...');
                    try {
                        const providersQuery = `SELECT user_id FROM public.users WHERE role = 'provider'`;
                        const providersResult = await servicesPool.query(providersQuery);
                        targetUsers = providersResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال لمزودي الخدمات: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب مزودي الخدمات:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب مزودي الخدمات' });
                        return;
                    }
                    break;

                case 'admins':
                    // إرسال للمشرفين فقط
                    console.log('🔍 جلب المشرفين...');
                    try {
                        const adminsQuery = `SELECT user_id FROM public.users WHERE role = 'admin'`;
                        const adminsResult = await servicesPool.query(adminsQuery);
                        targetUsers = adminsResult.rows.map(row => row.user_id);
                        console.log(`📡 إرسال للمشرفين: ${targetUsers.length} مستخدم`, targetUsers);
                    } catch (dbErr) {
                        console.error('❌ خطأ في جلب المشرفين:', dbErr);
                        socket.emit('notification_error', { error: 'فشل جلب المشرفين' });
                        return;
                    }
                    break;

                case 'selected':
                    if (!targetUserIds || targetUserIds.length === 0) {
                        console.error('❌ يجب اختيار مستخدم واحد على الأقل');
                        socket.emit('notification_error', { error: 'يجب اختيار مستخدم واحد على الأقل' });
                        return;
                    }
                    targetUsers = targetUserIds;
                    console.log(`📡 إرسال للمستخدمين المختارين: ${targetUsers.length} مستخدم`, targetUsers);
                    break;

                default:
                    console.error(`❌ نوع استهداف غير صالح: ${targetType}`);
                    socket.emit('notification_error', { error: 'نوع استهداف غير صالح' });
                    return;
            }

            if (targetUsers.length === 0) {
                console.warn('⚠️ لا يوجد مستخدمين مستهدفين');
                socket.emit('notification_error', { error: 'لا يوجد مستخدمين مستهدفين' });
                return;
            }

            // إرسال الإشعار لكل مستخدم
            console.log(`🚀 بدء إرسال الإشعار إلى ${targetUsers.length} مستخدم...`);
            for (const userId of targetUsers) {
                try {
                    console.log(`💾 حفظ إشعار للمستخدم ${userId}...`);
                    // حفظ الإشعار في قاعدة البيانات
                    const insertQuery = `
                        INSERT INTO "public"."notifications" (user_id, title, message, type, is_read, created_at)
                        VALUES ($1, $2, $3, $4, false, NOW())
                        RETURNING id
                    `;
                    const result = await servicesPool.query(insertQuery, [userId, title, message, type || 'info']);
                    const notificationId = result.rows[0].id;
                    console.log(`✅ تم حفظ الإشعار ${notificationId} للمستخدم ${userId}`);

                    // إرسال الإشعار في الوقت الفعلي إذا كان المستخدم متصلاً
                    const targetSocketId = connectedUsers.get(userId);
                    if (targetSocketId) {
                        console.log(`📡 إرسال فوري للمستخدم ${userId} (Socket: ${targetSocketId})`);
                        io.to(targetSocketId).emit('new_notification', {
                            id: notificationId,
                            title,
                            message,
                            type: type || 'info',
                            created_at: new Date().toISOString()
                        });
                        sentCount++;
                    } else {
                        console.log(`💤 المستخدم ${userId} غير متصل، تم حفظ الإشعار فقط`);
                    }
                } catch (err) {
                    console.error(`❌ خطأ في إرسال إشعار للمستخدم ${userId}:`, err);
                }
            }

            console.log(`✅ تم إرسال الإشعار بنجاح إلى ${sentCount} مستخدم متصل، وحفظه لـ ${targetUsers.length} مستخدم`);

            socket.emit('notification_sent', {
                success: true,
                sentCount,
                totalTargeted: targetUsers.length
            });
        } catch (err) {
            console.error('❌ خطأ عام في إرسال الإشعار:', err);
            socket.emit('notification_error', { error: 'فشل إرسال الإشعار: ' + err.message });
        }
    });

    // طلب الإشعارات غير المقروءة
    socket.on('get_unread_notifications', async (data) => {
        console.log('📨 طلب الإشعارات غير المقروءة:', data);

        const userId = data.user_id || data;

        if (!userId) {
            console.error('❌ معرف المستخدم مطلوب');
            socket.emit('notifications_error', { error: 'معرف المستخدم مطلوب' });
            return;
        }

        try {
            console.log('🔍 جلب الإشعارات للمستخدم:', userId);
            const query = `
                SELECT id, title, message, type, is_read, created_at
                FROM "public"."notifications"
                WHERE user_id = $1
                ORDER BY created_at DESC
                LIMIT 50
            `;
            const result = await servicesPool.query(query, [userId]);
            console.log('✅ تم جلب', result.rows.length, 'إشعار للمستخدم', userId);
            socket.emit('unread_notifications', result.rows);
        } catch (err) {
            console.error('❌ خطأ في جلب الإشعارات:', err);
            socket.emit('notifications_error', { error: 'فشل جلب الإشعارات' });
        }
    });

    // تعليم إشعار كمقروء
    socket.on('mark_notification_read', async (notificationId) => {
        try {
            console.log('📖 تعليم الإشعار كمقروء:', notificationId);
            const query = `
                UPDATE "public"."notifications"
                SET is_read = true, read_at = NOW()
                WHERE id = $1
            `;
            await servicesPool.query(query, [notificationId]);
            console.log('✅ تم تعليم الإشعار كمقروء وتسجيل وقت القراءة');
            socket.emit('notification_marked_read', { success: true });
        } catch (err) {
            console.error('❌ خطأ في تعليم الإشعار كمقروء:', err);
            socket.emit('notification_error', { error: 'فشل تعليم الإشعار' });
        }
    });
});

// تصدير io لاستخدامه في أماكن أخرى إذا لزم الأمر
global.io = io;

// بدء السيرفر مع دعم Socket.io
server.listen(PORT, () => {
    console.log('==============================================');
    console.log(`🚀 السيرفر يعمل الآن على: http://0.0.0.0:${PORT}`);
    console.log(`📊 لوحة التحكم: http://0.0.0.0:${PORT}/dashboard.html`);
    console.log(`📊 نظام تحديث الـ PostGIS والـ WFS-T متكامل ومؤمن بالكامل بالقيم الجغرافية الحقيقية`);
    console.log(`📡 قاعدة البيانات: host=${PG_HOST}, services=${SERVICES_DB_NAME}, realestate=${REAL_ESTATE_DB_NAME}`);
    console.log(`📡 GeoServer target: ${GEOSERVER_TARGET}`);
    console.log(`🔌 Socket.io مفعل وجاهز للإشعارات`);
    console.log('==============================================');
});