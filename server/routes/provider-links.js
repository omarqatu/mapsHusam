// Which map features belong to an active provider account (the request button vs call / WhatsApp).
import { IS_PROD, app } from '../app.js';
import { servicesPool } from '../database.js';
import { providerLinkedCache } from '../state.js';

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
        if (providerLinkedCache.data && Date.now() < providerLinkedCache.expiresAt) {
            return res.json({ success: true, linked: providerLinkedCache.data });
        }
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

        providerLinkedCache.data = linked;
        providerLinkedCache.expiresAt = Date.now() + 30000;
        res.json({ success: true, linked });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب قائمة مزودي الخدمة المرتبطين:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});
