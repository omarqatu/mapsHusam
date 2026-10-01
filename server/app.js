// Settings and security: the Express app, the HTTP and socket.io servers, and the middleware every request passes.
// تحميل متغيرات البيئة من ملف .env
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import bcrypt from 'bcrypt';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import compression from 'compression';
import crypto from 'crypto';

// جذر المشروع (هذا الملف داخل server/)
const __filename = fileURLToPath(import.meta.url);
export const ROOT_DIR = path.resolve(path.dirname(__filename), '..');

export const BCRYPT_SALT_ROUNDS = 10;
export const IS_PROD = process.env.NODE_ENV === 'production';
// طباعة تفصيلية عند الحاجة فقط: DEBUG_LOGS=1 بملف .env (بدونها لا تُطبع سطور لكل طلب)
export const debugLog = (...args) => { if (process.env.DEBUG_LOGS === '1') console.log(...args); };
const BCRYPT_HASH_REGEX = /^\$2[aby]\$\d{2}\$/;
const JWT_SECRET_FROM_ENV = !!process.env.JWT_SECRET
    && process.env.JWT_SECRET.length >= 32
    && !/change_this|your_|secret_key|changeme/i.test(process.env.JWT_SECRET); // يرفض القيم النموذجية
export const ADMIN_JWT_SECRET = JWT_SECRET_FROM_ENV ? process.env.JWT_SECRET : crypto.randomBytes(48).toString('hex');

if (!JWT_SECRET_FROM_ENV) {
    console.error('❌ خطأ أمني: JWT_SECRET غير مضبوط - تم توليد مفتاح مؤقت عشوائي.');
    console.error('📝 أضف بملف .env سطراً مثل: JWT_SECRET=' + crypto.randomBytes(32).toString('hex'));
    // بالإنتاج المفتاح العشوائي يُسقط كل جلسات المستخدمين عند كل إعادة تشغيل (ولا يعمل مع أكثر من نسخة)، فلا نقلع به.
    if (IS_PROD) {
        console.error('⛔ NODE_ENV=production بلا JWT_SECRET صالح (32 حرفاً فأكثر): إيقاف التشغيل.');
        process.exit(1);
    }
}
// =========================================================================
// 🆕 [ترحيل آمن لكلمات المرور]: الحسابات القديمة محفوظة بكلمة مرور نصية
// صريحة بقاعدة البيانات (قبل هذا التعديل). هذه الدالة تتحقق من كلمة المرور
// بطريقتين: إذا كانت القيمة المخزّنة تبدو كـ bcrypt hash نستخدم bcrypt.compare
// العادي، وإلا (حساب قديم لم يُحدَّث بعد) نقارنها نصياً كما كان يعمل النظام
// سابقاً فقط لمرة الدخول هذه، ثم نُعيد تشفيرها فوراً بـ bcrypt حتى لا تبقى
// نصاً صريحاً بعد أول تسجيل دخول ناجح لهذا المستخدم.
// =========================================================================
export async function verifyPasswordWithMigration(plainPassword, storedValue) {
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
    // السماح بـ localhost أثناء التطوير
    if (origin.includes('localhost') || origin.includes('127.0.0.1')) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    return callback(new Error('غير مسموح بالوصول من هذا الدومين (CORS)'));
}

export const app = express();
export const server = http.createServer(app);

// 🔒 Security Middleware
if (process.env.ENABLE_HELMET !== 'false') {
    app.use(helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                imgSrc: ["'self'", "data:", "blob:", "https:"],
                mediaSrc: ["'self'", "https:"],
                fontSrc: ["'self'", "data:"],
                // 🆕 [تشديد أمني تدريجي]: أُزيلت 'unsafe-eval' - أخطر توجيه بالـ CSP لأنه
                // يسمح بتنفيذ أي نص كـ كود JS (eval/new Function). لم يعد ضرورياً لأي من
                // مكتباتك الحالية. إن ظهر خطأ "unsafe-eval" بالـ Console لأي مكتبة بعد هذا
                // التعديل، أعد 'unsafe-eval' مؤقتاً وأخبرني بالمكتبة المسبّبة لنعالجها بدقة.
                // 🔒 السكربتات من الموقع نفسه فقط: الواجهة (web/dist) لا تحمّل أي سكربت من CDN، والسماح بـ CDN عام
                // (jsdelivr يقدّم أي حزمة npm) كان يتيح تجاوز هذه السياسة بحقن سكربت من هناك.
                scriptSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                connectSrc: ["'self'", "ws:", "wss:", "https:"],
                frameSrc: ["'self'", "https://www.youtube.com"]
            }
        },
        hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true
        }
    }));
}

// 🗜️ ضغط الاستجابات (نتائج GeoJSON كبيرة) - نتجاوز البروكسي وSocket.io
app.use(compression({
    threshold: 1024,
    filter: (req, res) => {
        if (req.path.startsWith('/geoserver-proxy') || req.path.startsWith('/socket.io')) return false;
        return compression.filter(req, res);
    }
}));

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

export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: parseInt(process.env.AUTH_RATE_LIMIT) || 10, // زيادة الحد إلى 10
    message: { success: false, error: 'محاولات تسجيل دخول كثيرة، يرجى المحاولة لاحقاً' }
});

// 🔒 قفل مؤقت بعد محاولات دخول فاشلة كثيرة. المفتاح رقم الجوال + عنوان الجهاز، فلا يستطيع غريب قفل حساب غيره
// بإرسال محاولات خاطئة باسمه؛ وسقف أعلى لرقم الجوال من كل العناوين معاً يوقف التخمين الموزّع.
const LOGIN_MAX_FAILS = Number(process.env.LOGIN_MAX_FAILS || 10);
const LOGIN_MAX_FAILS_ANY_IP = LOGIN_MAX_FAILS * 5;
const LOGIN_LOCK_WINDOW_MS = 15 * 60 * 1000;
const loginFailures = new Map(); // "phone|ip" و "phone" -> { count, firstAt }
const loginKeys = (phone, ip) => [[`${phone}|${ip}`, LOGIN_MAX_FAILS], [phone, LOGIN_MAX_FAILS_ANY_IP]];
export function isLoginLocked(phone, ip) {
    return loginKeys(phone, ip).some(([key, max]) => {
        const rec = loginFailures.get(key);
        if (!rec) return false;
        if (Date.now() - rec.firstAt > LOGIN_LOCK_WINDOW_MS) { loginFailures.delete(key); return false; }
        return rec.count >= max;
    });
}
export function recordLoginFailure(phone, ip) {
    const now = Date.now();
    if (loginFailures.size > 50000) loginFailures.clear(); // حماية من تضخم الذاكرة
    for (const [key] of loginKeys(phone, ip)) {
        const rec = loginFailures.get(key);
        if (!rec || now - rec.firstAt > LOGIN_LOCK_WINDOW_MS) loginFailures.set(key, { count: 1, firstAt: now });
        else rec.count++;
    }
}
export function clearLoginFailures(phone, ip) { loginFailures.delete(`${phone}|${ip}`); }
setInterval(() => {
    const now = Date.now();
    for (const [key, rec] of loginFailures) {
        if (now - rec.firstAt > LOGIN_LOCK_WINDOW_MS) loginFailures.delete(key);
    }
}, 10 * 60 * 1000).unref();

// 🆕 حماية مسارات تسجيل الأحداث/النقرات العامة من الإغراق الآلي (بوتات)
export const publicEventsLimiter = rateLimit({
    windowMs: 60 * 1000, // دقيقة واحدة
    max: 30,             // 30 طلباً بالدقيقة لكل جهاز - أعلى من أي استخدام طبيعي
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'طلبات كثيرة جداً من هذا الجهاز، يرجى الانتظار قليلاً.' }
});

// 🆕 [تراجع]: تم إلغاء تطبيق apiLimiter على كل /api/ لأنه يُحسب بالـ IP
// وليس بالمستخدم - في بيئة تحوي فقط مستخدمين مسجلين (بلا زوار)، الحماية
// الصحيحة هي checkUserRequestQuota (لكل user_id على حدة، مفتوح افتراضياً).
// حد الـ IP العام كان يجمع كل التبويبات/الصفحات المفتوحة من نفس الجهاز على
// عداد واحد، فيصل للحد بسرعة أثناء الاستخدام أو الاختبار الطبيعي.
// authLimiter يبقى مفعّلاً فقط على تسجيل الدخول/التسجيل (لا يؤثر على الاستخدام العادي).
if (process.env.ENABLE_RATE_LIMITING !== 'false') {
    // app.use('/api/', apiLimiter); // مُعطَّل عمداً - راجع الشرح أعلاه
}

export const io = new Server(server, {
    cors: {
        origin: ALLOWED_ORIGINS || '*',
        methods: ['GET', 'POST']
    }
});

app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1)); // عدد الوسطاء الفعلي أمام Node (IIS = 1)
export const PORT = process.env.PORT || 3000;

// 2. الميدل وير (Middlewares)
app.use(cors({
    origin: corsOriginCheck,
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text({ type: ['application/xml', 'text/xml', 'application/vnd.ogc.wfs-transaction+xml'], limit: '2mb' }));

// ميدل وير لمصادفة أخطاء JSON: يرجع استجابة JSON بدلاً من صفحة HTML إذا كان جسم الطلب غير صالح
app.use((err, req, res, next) => {
    if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        console.error('❌ خطأ في تحليل JSON:', err.message);
        return res.status(400).json({ error: 'تنسيق JSON غير صالح في جسم الطلب.' });
    }
    next(err);
});
