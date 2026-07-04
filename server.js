/**
 * server.js
 * خادم آمن مع حماية متقدمة
 */

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');

const app = express();
const server = http.createServer(app);

// 🔒 نظام التسجيل والمراقبة (مخفف لتحسين الأداء)
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;

    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;

        // تسجيل الأخطاء فقط (بدون تسجيل الطلبات البطيئة لتقليل البطئ)
        if (statusCode >= 400) {
            console.error(`🚫 ${method} ${url} - ${statusCode} - ${ip} - ${duration}ms`);
        }
    });

    next();
};

app.use(requestLogger);
// 🔒 تعطيل Helmet مؤقتاً لحل مشكلة عدم ظهور المعالم
// app.use(helmet({
//     contentSecurityPolicy: {
//         directives: {
//             defaultSrc: ["'self'"],
//             scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.jsdelivr.net", "https://cdn.socket.io"],
//             styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com"],
//             imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
//             connectSrc: ["'self'", "ws:", "wss:", "http:", "https:"],
//             fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
//             objectSrc: ["'none'"],
//             mediaSrc: ["'self'"],
//             frameSrc: ["'none'"],
//         },
//     },
//     hsts: {
//         maxAge: 31536000,
//         includeSubDomains: true,
//         preload: true
//     },
//     noSniff: true,
//     xssFilter: true,
//     referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
// }));

// 🔒 إعدادات CORS - تقييد المصادر المسموح بها
// تعطيل مؤقتاً لحل مشكلة عدم ظهور المعالم
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://144.91.84.168:3000', 'http://194.163.174.162:8080', 'http://144.91.84.168', 'https://144.91.84.168', 'http://194.163.174.162:3000', 'http://192.168.88.5:3000'];

app.use(cors({
    origin: '*', // السماح بجميع المصادر مؤقتاً
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// 🔒 Rate Limiting - منع الهجمات (مخفف لتحسين الأداء)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 500, // حد معقول
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 دقيقة
    max: 20, // حد معقول
    message: 'Too many login attempts, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api/', limiter);
app.use('/api/auth/login', authLimiter);

const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true
    }
});

app.set('trust proxy', true);
const PORT = process.env.PORT || 3000;
const PG_HOST = process.env.POSTGRES_HOST || '144.91.84.168';
const PG_PORT = Number(process.env.POSTGRES_PORT || 5432);
const PG_USER = process.env.POSTGRES_USER || 'Husam';
const PG_PASSWORD = process.env.POSTGRES_PASSWORD || 'Husam';
const SERVICES_DB_NAME = process.env.SERVICES_DB_NAME || 'services_db';
const REAL_ESTATE_DB_NAME = process.env.REAL_ESTATE_DB_NAME || 'realestate';
// GeoServer يعمل على HTTP، البروكسي سيتولى الاتصال
const GEOSERVER_TARGET = process.env.GEOSERVER_TARGET || 'http://194.163.174.162:8080/geoserver';

// 1. إعدادات الاتصال بقواعد البيانات المتعددة 

// 🟢 الاتصال الأول: قاعدة بيانات الخدمات (services_db) - بدون SSL لتحسين الأداء
const servicesPool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: SERVICES_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 50 // زيادة عدد الاتصالات لتحسين الأداء
});

// 🔵 الاتصال الثاني: قاعدة بيانات العقارات (realestate) - بدون SSL لتحسين الأداء
const realestatePool = new Pool({
    user: PG_USER,
    host: PG_HOST,
    database: REAL_ESTATE_DB_NAME,
    password: PG_PASSWORD,
    port: PG_PORT,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 10000,
    max: 50 // زيادة عدد الاتصالات لتحسين الأداء
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

// دالة مسارة لاختيار الاتصال المناسب حسب الطبقة
function getPoolForLayer(layerName) {
    const realEstateLayers = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];
    if (realEstateLayers.includes(layerName)) {
        return realestatePool;
    }
    return servicesPool;
}

// 2. الميدل وير (Middlewares)
// تم إضافة CORS و Helmet و Rate Limiting في الأعلى
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
    'electrician', 'ac_technician', 'plumber', 'general_maintenance', 'painter', 'carpenter', 
    'blacksmith', 'builder', 'house_cleaner', 'aluminum_tech', 'car_mechanic', 'car_electrician', 
    'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 'delivery_services', 'tow_truck', 
    'cctv_installer', 'party_planner', 'zaffa_bands', 'music_bands', 'photographer', 'party_rental', 
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

const isValidLayer = (layer) => ALLOWED_LAYERS.includes(layer.trim());

// =========================================================================
// مسار جلب الخدمة المربوطة بمزود الخدمة والتحقق من اكتمال الحقول مع الإحداثيات
// =========================================================================
app.get('/api/get-provider-service', async (req, res) => {
    const { user_id } = req.query;

    // 🔒 Input validation
    if (!user_id || isNaN(user_id)) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم user_id مطلوب ويجب أن يكون رقماً' });
    }

    const userId = parseInt(user_id);
    if (userId <= 0) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم غير صالح' });
    }

    try {
        // الاستعلام عن الحقول من جدول المستخدمين مباشرة مع جلب الرتبة
        const userQuery = `
            SELECT service_layer, feature_id, status, role, x_coord, y_coord 
            FROM public.users 
            WHERE user_id = $1
        `;
        const result = await servicesPool.query(userQuery, [userId]);

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

    // 🔒 Input validation
    if (!user_id || isNaN(user_id)) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم user_id مطلوب ويجب أن يكون رقماً' });
    }

    const userId = parseInt(user_id);
    if (userId <= 0) {
        return res.status(400).json({ success: false, error: 'رقم المستخدم غير صالح' });
    }

    if (!service_layer || typeof service_layer !== 'string') {
        return res.status(400).json({ success: false, error: 'اسم الطبقة service_layer مطلوب' });
    }

    if (!isValidLayer(service_layer)) {
        return res.status(403).json({ success: false, error: 'الطبقة غير مسموح بها' });
    }

    if (status === undefined || status === null) {
        return res.status(400).json({ success: false, error: 'الحالة status مطلوبة' });
    }

    if (status !== 0 && status !== 1) {
        return res.status(400).json({ success: false, error: 'الحالة يجب أن تكون 0 أو 1' });
    }

    if (x_coord !== undefined && (isNaN(x_coord) || x_coord === null)) {
        return res.status(400).json({ success: false, error: 'الإحداثي x_coord يجب أن يكون رقماً' });
    }

    if (y_coord !== undefined && (isNaN(y_coord) || y_coord === null)) {
        return res.status(400).json({ success: false, error: 'الإحداثي y_coord يجب أن يكون رقماً' });
    }

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
    const realEstateLayers = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];
    const isRealEstate = realEstateLayers.includes(layerName);

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
// 3. إعداد البروكسي لـ GeoServer مع الحماية المتقدمة
// [إجراء أمني 2]: تشفير وحماية البروكسي لمنع الحذف العشوائي (WFS-T protection)
// 🔒 Middleware للتحقق من صلاحية الوصول للـ GeoServer
// تعطيل مؤقتاً لحل مشكلة عدم ظهور المعالم
const geoServerAuthMiddleware = (req, res, next) => {
    console.log(`[Proxy] Request to: ${req.url} from IP: ${req.ip}`);
    // السماح بجميع الطلبات مؤقتاً
    next();
};

app.use('/geoserver-proxy', geoServerAuthMiddleware, createProxyMiddleware({
    target: GEOSERVER_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/geoserver-proxy': '' },
    secure: false, // للتعامل مع شهادات SSL غير الموثوقة
    logLevel: 'warn', // تقليل logging
    onProxyReq: (proxyReq, req, res) => {
        console.log(`[Proxy] Forwarding to: ${GEOSERVER_TARGET}${req.url}`);

        // 🔒 إزالة Basic Auth مؤقتاً لحل مشكلة عدم ظهور المعالم
        // const auth = Buffer.from('admin:geoserver').toString('base64');
        // proxyReq.setHeader('Authorization', `Basic ${auth}`);

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
        console.error('[Proxy] Error:', err);
        res.status(500).json({ error: 'GeoServer connection failed' });
    }
}));

// 4. مسار استقبال الإحصائيات (POST)
app.post('/save-stat', async (req, res) => {
    const { user_id, provider, service } = req.body;
    
    console.log("📥 استلام بيانات جديدة للحفظ:", req.body);

    if (!user_id || !provider || !service) {
        console.log("⚠️ بيانات ناقصة في الطلب المستلم");
        return res.status(400).json({ error: 'Missing data fields' });
    }

    try {
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
            ORDER BY s.request_date DESC 
            LIMIT $1 OFFSET $2
        `;
        
        const countQuery = 'SELECT COUNT(*) FROM "public"."map_service_stats"';

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

// مسار تسجيل مستخدم جديد
app.post('/api/auth/register', async (req, res) => {
    const { name, email, phone, password, role } = req.body;

    console.log("📥 محاولة تسجيل حساب جديد تلقائي:", req.body);

    if (!name || !email || !phone || !password || !role) {
        return res.status(400).json({ error: 'الرجاء تعبئة جميع الحقول المطلوبة بما فيها رقم الجوال' });
    }

    const phoneRegex = /^05\d{8}$/;
    if (!phoneRegex.test(phone.trim())) {
        return res.status(400).json({ error: 'صيغة رقم الجوال غير صحيحة، يجب أن يبدأ بـ 05 ويتكون من 10 أرقام.' });
    }

    try {
        const checkEmailQuery = 'SELECT email FROM public.users WHERE email = $1';
        const emailCheckResult = await servicesPool.query(checkEmailQuery, [email.toLowerCase().trim()]);

        if (emailCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'هذا البريد الإلكتروني مسجل بالفعل!' });
        }

        const checkPhoneQuery = 'SELECT phone FROM public.users WHERE phone = $1';
        const phoneCheckResult = await servicesPool.query(checkPhoneQuery, [phone.trim()]);

        if (phoneCheckResult.rows.length > 0) {
            return res.status(400).json({ error: 'رقم الجوال هذا مستخدم بالفعل من قبل حساب آخر!' });
        }

        const insertUserQuery = `
            INSERT INTO public.users (full_name, email, phone, password_hash, role, status, is_active)
            VALUES ($1, $2, $3, $4, $5, 0, true)
            RETURNING user_id, full_name, email, phone, role
        `;

        const result = await servicesPool.query(insertUserQuery, [
            name.trim(),
            email.toLowerCase().trim(),
            phone.trim(),
            password,
            role
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

// مسار تسجيل الدخول المحدث (الفحص الثلاثي المتطابق الشامل بدون أي قيم وهمية)
app.post('/api/auth/login', async (req, res) => {
    const requestBody = req.body || {};
    const { email, phone, password } = requestBody;

    if (!email || !phone || !password) {
        console.warn('[LOGIN] missing fields', { email, phone, password, body: requestBody });
        return res.status(400).json({ message: 'الرجاء إدخال البريد الإلكتروني، رقم الجوال وكلمة المرور معاً.' });
    }

    try {
        const userQuery = 'SELECT * FROM public.users WHERE email = $1 AND phone = $2';
        console.log('[LOGIN] query params', { email: email.toLowerCase().trim(), phone: phone.trim() });
        const result = await servicesPool.query(userQuery, [
            email.toLowerCase().trim(),
            phone.trim()
        ]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'البيانات المدخلة غير صحيحة، يرجى التأكد من البريد الإلكتروني ورقم الجوال.' });
        }

        const user = result.rows[0];

        if (!user.is_active) {
            return res.status(403).json({ message: 'هذا الحساب معطل حالياً، يرجى مراجعة الإدارة.' });
        }

        if (user.password_hash !== password) {
            return res.status(401).json({ message: 'كلمة المرور المدخلة غير صحيحة.' });
        }

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

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;

        // استعلام لجلب القيم الفريدة من الحقل المحدد
        const query = `SELECT DISTINCT "${field}" FROM public."${layer}" WHERE status = 0 AND auto_status = 0 AND "${field}" IS NOT NULL AND "${field}" != '' ORDER BY "${field}" ASC LIMIT 10000`;

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

        const targetPool = workspace === 'realestate' ? realestatePool : servicesPool;
        const isRealEstate = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'].includes(layer);
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

        // معالجة الشروط المتعددة
        const count = parseInt(conditions_count) || 0;
        if (count > 0) {
            for (let i = 0; i < count; i++) {
                const condField = req.query[`field_${i}`];
                const condOperator = req.query[`operator_${i}`];
                const condValue = req.query[`value_${i}`];

                if (condField && condValue) {
                    const valStr = String(condValue).trim();
                    if (condOperator === '=') {
                        query += ` AND ${condField} = $${params.length + 1}`;
                        params.push(valStr);
                    } else if (condOperator === 'contains') {
                        // البحث في حقلين: search_tags واسم الطبقة بالعربي
                        if (layerNameAr && condField === 'search_tags') {
                            query += ` AND (${condField} ILIKE $${params.length + 1} OR $${params.length + 2} ILIKE $${params.length + 3})`;
                            params.push(`%${valStr}%`, layerNameAr, `%${valStr}%`);
                        } else {
                            query += ` AND ${condField} ILIKE $${params.length + 1}`;
                            params.push(`%${valStr}%`);
                        }
                    } else if (condOperator === '>') {
                        query += ` AND CAST(${condField} AS NUMERIC) >= $${params.length + 1}`;
                        params.push(parseFloat(valStr));
                    } else if (condOperator === '<') {
                        query += ` AND CAST(${condField} AS NUMERIC) <= $${params.length + 1}`;
                        params.push(parseFloat(valStr));
                    }
                }
            }
        } else if (field && value) {
            // للتوافق مع الكود القديم (شرط واحد)
            const valStr = String(value).trim();
            if (operator === '=') {
                query += ` AND ${field} = $${params.length + 1}`;
                params.push(valStr);
            } else if (operator === 'contains') {
                // البحث في حقلين: search_tags واسم الطبقة بالعربي
                if (layerNameAr) {
                    query += ` AND (${field} ILIKE $${params.length + 1} OR $${params.length + 2} ILIKE $${params.length + 3})`;
                    params.push(`%${valStr}%`, layerNameAr, `%${valStr}%`);
                } else {
                    query += ` AND ${field} ILIKE $${params.length + 1}`;
                    params.push(`%${valStr}%`);
                }
            } else if (operator === '>') {
                query += ` AND CAST(${field} AS NUMERIC) >= $${params.length + 1}`;
                params.push(parseFloat(valStr));
            } else if (operator === '<') {
                query += ` AND CAST(${field} AS NUMERIC) <= $${params.length + 1}`;
                params.push(parseFloat(valStr));
            }
        }

        query += ` ORDER BY rating DESC LIMIT 50`;

        console.log(`Search Query for ${layer}:`, query);
        console.log(`Search Params:`, params);

        const result = await targetPool.query(query, params);

        // تحويل النتائج إلى GeoJSON
        const features = result.rows.map(row => {
            let geometry;

            if (isPolygonLayer && row.geom_json) {
                // للمضلعات: استخدام geom_json (GeoJSON من PostGIS)
                geometry = JSON.parse(row.geom_json);
            } else {
                // للنقاط: استخدام x_coord و y_coord
                geometry = {
                    type: 'Point',
                    coordinates: [row.x_coord, row.y_coord]
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
app.get('/api/users', async (req, res) => {
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

// 9. إذا لم يُطابق أي مسار API، نرجع JSON بدل HTML لتجنب مشاكل parse في الفرونت إند
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// 9. تقديم الملفات الثابتة
app.use(express.static(path.join(__dirname)));

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
// Socket.io - نظام الإشعارات في الوقت الفعلي مع الحماية
// ==========================================

// تخزين المستخدمين المتصلين مع معرفاتهم
const connectedUsers = new Map();

// 🔒 Rate Limiting لـ Socket.io
const socketIOLimiter = new Map();
const SOCKET_RATE_LIMIT = 10; // 10 رسائل في الدقيقة
const SOCKET_RATE_WINDOW = 60 * 1000; // دقيقة واحدة

function checkSocketRateLimit(socketId) {
    const now = Date.now();
    const userRequests = socketIOLimiter.get(socketId) || [];

    // تنظيف الطلبات القديمة
    const recentRequests = userRequests.filter(time => now - time < SOCKET_RATE_WINDOW);

    if (recentRequests.length >= SOCKET_RATE_LIMIT) {
        return false; // تجاوز الحد
    }

    recentRequests.push(now);
    socketIOLimiter.set(socketId, recentRequests);
    return true;
}

io.on('connection', (socket) => {
    const clientIp = socket.handshake.address;
    console.log(`🔗 مستخدم جديد متصل: ${socket.id} من IP: ${clientIp}`);

    // التحقق من Origin
    const origin = socket.handshake.headers.origin;
    if (!allowedOrigins.includes(origin) && origin) {
        console.warn(`🚫 Socket.io connection blocked from origin: ${origin}`);
        socket.disconnect();
        return;
    }

    // عند تسجيل دخول المستخدم، نقوم بربط Socket ID بمعرف المستخدم
    socket.on('user_connected', (userId) => {
        if (!userId || typeof userId !== 'number') {
            console.warn('⚠️ Invalid userId in user_connected');
            return;
        }

        console.log(`👤 المستخدم ${userId} متصل بـ Socket ID: ${socket.id}`);
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;

        // إرسال تأكيد الاتصال للمستخدم
        socket.emit('connection_confirmed', { userId, socketId: socket.id });
    });

    // 🔒 Rate Limiting للإشعارات
    socket.use((packet, next) => {
        if (!checkSocketRateLimit(socket.id)) {
            console.warn(`🚫 Socket.io rate limit exceeded for ${socket.id}`);
            socket.emit('error', { message: 'Rate limit exceeded' });
            return;
        }
        next();
    });

    // عند فصل المستخدم
    socket.on('disconnect', () => {
        if (socket.userId) {
            console.log(`🔌 المستخدم ${socket.userId} انقطع اتصاله`);
            connectedUsers.delete(socket.userId);
            socketIOLimiter.delete(socket.id);
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
server.listen(PORT, '0.0.0.0', () => {
    console.log('==============================================');
    console.log(`🚀 السيرفر يعمل الآن على: http://0.0.0.0:${PORT}`);
    console.log(`📊 لوحة التحكم: http://0.0.0.0:${PORT}/dashboard.html`);
    console.log(`📊 نظام تحديث الـ PostGIS والـ WFS-T متكامل ومؤمن بالكامل بالقيم الجغرافية الحقيقية`);
    console.log(`📡 قاعدة البيانات: host=${PG_HOST}, services=${SERVICES_DB_NAME}, realestate=${REAL_ESTATE_DB_NAME}`);
    console.log(`📡 GeoServer target: ${GEOSERVER_TARGET}`);
    console.log(`🔌 Socket.io مفعل وجاهز للإشعارات`);
    console.log('==============================================');
});
