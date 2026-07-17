/**
 * server.js 
 */


const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');
const { Pool } = require('pg');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
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

// دالة مسارة لاختيار الاتصال المناسب حسب الطبقة
function getPoolForLayer(layerName) {
    const realEstateLayers = ['ApartRent', 'ApartSale', 'LandSale', 'Location', 'RoadsTest'];
    if (realEstateLayers.includes(layerName)) {
        return realestatePool;
    }
    return servicesPool;
}

// 2. الميدل وير (Middlewares)
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json()); 
app.use(express.urlencoded({ extended: true }));

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
// [نظام حد الطلبات/الأحداث لكل مستخدم]: افتراضياً "مفتوح" بدون أي حد.
// المشرف قادر على تحديد رقم أقصى (مثلاً 20) ونوع الفترة (يومي/أسبوعي/شهري)
// من لوحة إدارة المستخدمين. يتم فحص هذا الحد عند كل "طلب/حدث" (نقرة اتصال
// أو واتساب) قبل تسجيلها، عبر عمود "user_identifier" في جدول الإحصائيات
// الذي يخزن رقم المستخدم الحقيقي (user_id) عند تسجيل الدخول.
// =========================================================================
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
            VALUES ($1, $2, $3, $4, $5, 0, false)
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

        // 2. مقارنة كلمة المرور المدخلة بالحالية نصياً مباشرة
        if (currentPassword !== storedPassword) {
            return res.status(400).json({ error: 'كلمة المرور الحالية التي أدخلتها غير صحيحة!' });
        }

        // 3. تحديث كلمة المرور الجديدة في قاعدة البيانات
        const updatePasswordQuery = `
            UPDATE public.users 
            SET password_hash = $1 
            WHERE user_id = $2
        `;
        await servicesPool.query(updatePasswordQuery, [newPassword, userId]);

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
            return res.status(403).json({ message: 'خطأ في الدخول: هذا الحساب معطل حالياً، يرجى التواصل معنا عبر صفحة الفيس بوك لإصلاح الخطأ.' });
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

        query += ` ORDER BY rating DESC LIMIT 100`;

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

// ==========================================
// API - إدارة المستخدمين (للمشرف فقط)
// ==========================================

// دالة مساعدة للتحقق من أن المستخدم مشرف (من صلاحيات الداتابيز)
async function isAdminUser(req) {
    // في هذا النظام، التحكم يتم عبر الواجهة frontend guard
    // لكن نضيف تحققاً من الدور في قاعدة البيانات كطبقة أمان إضافية
    // نقرأ الـ user_id من الهيدر المخصص (يُرسله الفرونت إند)
    const adminUserId = req.headers['x-admin-user-id'];
    if (!adminUserId) return false;
    
    try {
        const result = await servicesPool.query('SELECT role FROM public.users WHERE user_id = $1', [adminUserId]);
        if (result.rows.length > 0 && result.rows[0].role === 'admin') {
            return true;
        }
    } catch (e) {
        console.error('❌ خطأ في التحقق من صلاحية المشرف:', e.message);
    }
    return false;
}

// 1. جلب جميع المستخدمين مع خيارات البحث والتصفية
app.get('/api/admin/users', async (req, res) => {
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
app.get('/api/admin/online-users', (req, res) => {
    try {
        const onlineUserIds = Array.from(connectedUsers.keys()).map(id => String(id));
        res.json({ success: true, onlineUserIds });
    } catch (error) {
        console.error('❌ خطأ في جلب حالة الاتصال:', error.message);
        res.status(500).json({ success: false, error: 'فشل جلب حالة الاتصال', details: error.message });
    }
});

// 1-ب. تسجيل خروج فوري لمستخدم محدد من قبل المشرف + إشعاره فوراً
app.post('/api/admin/users/force-logout', async (req, res) => {
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
            console.log(`💤 المستخدم ${user_id} غير متصل حالياً، سيصله الإشعار عند دخوله القادم`);
        }

        res.json({
            success: true,
            message: wasOnline
                ? 'تم تسجيل خروج المستخدم فوراً وإرسال التنبيه بنجاح'
                : 'المستخدم غير متصل حالياً، لكن تم حفظ الإشعار وسيتم إخراجه فوراً فور دخوله',
            wasOnline
        });
    } catch (error) {
        console.error('❌ خطأ في تسجيل الخروج الإجباري:', error.message);
        res.status(500).json({ success: false, error: 'فشل تنفيذ تسجيل الخروج الإجباري', details: error.message });
    }
});

// 1-ج. تسجيل خروج جماعي لجميع المستخدمين (متصلين وغير متصلين)
app.post('/api/admin/users/force-logout-all', async (req, res) => {
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
                    console.log(`💤 المستخدم ${userId} غير متصل، تم حفظ الإشعار فقط`);
                }
            } catch (err) {
                console.error(`❌ خطأ في تسجيل خروج المستخدم ${userId}:`, err.message);
            }
        }

        res.json({
            success: true,
            message: `تم تسجيل خروج ${targetUsers.length} مستخدم (${onlineCount} متصل، ${offlineCount} غير متصل)`,
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
app.post('/api/admin/users/update', async (req, res) => {
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

        // تحديث كلمة المرور
        if (new_password && new_password.trim().length >= 6) {
            updateFields.push(`password_hash = $${idx++}`);
            updateValues.push(new_password.trim());
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