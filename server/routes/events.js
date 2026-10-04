// Usage events: the request-limit check, map events and contact stats.
import jwt from 'jsonwebtoken';
import { ADMIN_JWT_SECRET, IS_PROD, app, publicEventsLimiter } from '../app.js';
import { servicesPool } from '../database.js';
import { bearerToken, checkUserRequestQuota, isTokenRevoked, requireAuth } from '../auth.js';

// 4-أ. مسار فحص حد الطلبات قبل تنفيذ أي "حدث/نقرة" (اتصال أو واتساب) - يُستدعى
// من الواجهة الأمامية قبل فتح رابط الاتصال أو الواتساب فعلياً
app.post('/api/check-request-limit', requireAuth, async (req, res) => {
    const quota = await checkUserRequestQuota(req.auth.uid);
    res.json({ success: true, ...quota });
});

// 4-ب. مسار تسجيل حدث/نقرة على الخريطة أو البحث (يُستدعى عند كل نقرة)
app.post('/api/log-map-event', requireAuth, async (req, res) => {
    const { event_type, provider, service, source } = req.body;
    const user_id = req.auth.uid; // 🔒 من التوكن
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

        // 🆕 تسجيل مصدر الحدث (خريطة / بحث سريع) لإحصائيات المنصة
        const sourcePage = source === 'quick_search' ? 'quick_search' : 'map';

        const query = `
            INSERT INTO "public"."map_service_stats" ("user_identifier", "provider_name", "service_type", "request_date", "source_page")
            VALUES ($1, $2, $3, NOW(), $4)
        `;

        await servicesPool.query(query, [user_id, provider || null, event_type, sourcePage]);

        console.log(`\x1b[32m%s\x1b[0m`, `✅ نجاح تسجيل الحدث: ${event_type}`);
        res.status(200).json({ status: 'success', message: 'Event logged successfully' });
    } catch (err) {
        console.error('❌ خطأ داخلي في SQL أثناء تسجيل الحدث:', err.message);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: IS_PROD ? undefined : err.message 
        });
    }
});

// 4. مسار استقبال الإحصائيات (POST)
app.post('/save-stat', publicEventsLimiter, async (req, res) => {
    const { provider, service, source } = req.body;
    // 🔒 لا نثق برقم المستخدم القادم بالجسم: صاحب توكن صالح يُسجَّل باسمه، والزائر يُسجَّل كضيف
    // (وإلا استطاع أي شخص حرق حصة طلبات مستخدم آخر أو تزوير إحصائياته).
    let user_id = null;
    const sessionToken = bearerToken(req);
    if (sessionToken && !isTokenRevoked(sessionToken)) {
        try {
            const decoded = jwt.verify(sessionToken, ADMIN_JWT_SECRET, { algorithms: ['HS256'] });
            if (Number.isInteger(Number(decoded.uid)) && Number(decoded.uid) > 0) user_id = String(Number(decoded.uid));
        } catch (e) { /* توكن غير صالح: يُعامل كزائر */ }
    }
    if (!user_id) {
        const guest = String(req.body.user_id || '').replace(/[<>]/g, '').trim().slice(0, 60);
        user_id = /^guest[_-]/i.test(guest) ? guest : 'guest';
    }

    console.log("📥 استلام بيانات جديدة للحفظ:", req.body);

    if (!provider || !service) {
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

                // 🆕 تسجيل مصدر الحدث (خريطة / بحث سريع) لإحصائيات المنصة
        const sourcePage = source === 'quick_search' ? 'quick_search' : 'map';

        const query = `
            INSERT INTO "public"."map_service_stats" ("user_identifier", "provider_name", "service_type", "request_date", "source_page")
            VALUES ($1, $2, $3, NOW(), $4)
        `;

        await servicesPool.query(query, [user_id, provider, service, sourcePage]);

        console.log(`\x1b[32m%s\x1b[0m`, `✅ نجاح الحفظ في قاعدة البيانات للخدمة: ${service}`);
        res.status(200).json({ status: 'success', message: 'Stat saved successfully' });
    } catch (err) {
        console.error('❌ خطأ داخلي في SQL أثناء الحفظ:', err.message);
        res.status(500).json({ 
            error: 'Internal Server Error', 
            details: IS_PROD ? undefined : err.message 
        });
    }
});
