/**
 * shared-utils.js
 * ------------------------------------------------------------------
 * 🆕 ملف موحّد يجمع دوال كانت مكررة حرفياً (نفس المنطق، نفس الكود تقريباً)
 * في أكثر من ملف: popup.js, no-map-search.js, edit-core.js, edit-wfs.js,
 * editPolygons.js, editLines.js, measure.js.
 *
 * يجب تحميل هذا الملف قبل أي ملف آخر يستخدم هذه الدوال (أضفناه في
 * index.html و no-map-search.html مباشرة بعد config.js).
 * ------------------------------------------------------------------
 */

// ==========================================================================
// 1) هوية المستخدم الحالي (مسجل دخول أو زائر) - كانت معرّفة بشكل شبه مطابق
//    في popup.js و no-map-search.js و search.js تحت أسماء مختلفة.
// ==========================================================================
window.getRealUserId = function () {
    try {
        const saved = localStorage.getItem('map_user');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.user_id || parsed.id)) {
                return String(parsed.user_id || parsed.id);
            }
        }
    } catch (e) { /* تجاهل */ }

    // fallback للـ GUID العشوائي إذا لم يكن المستخدم مسجلاً
    if (!localStorage.getItem('map_user_guid')) {
        localStorage.setItem('map_user_guid', 'guest_' + Math.random().toString(36).substr(2, 9));
    }
    return localStorage.getItem('map_user_guid');
};

// ==========================================================================
// 2) فحص حد الطلبات (الأحداث) قبل تنفيذ اتصال/واتساب مباشر، مع تنبيه المستخدم
//    عند التجاوز. كانت هذه الدالة مكررة حرفياً بين popup.js و no-map-search.js.
//    (هذه مستقلة عمداً عن window.checkAndLogMapEvent المعرّفة في search.js،
//    لأن تلك تفحص وتُسجّل الحدث في خطوة واحدة لعمليات البحث، بينما هذه فقط
//    تتحقق قبل اتصال/واتساب الذي يُسجَّل لاحقاً بشكل منفصل عبر sendTrackingRequest/
//    trackRequest مع اسم مزود الخدمة الفعلي - دمجهما يتطلب تعديل مسار سيرفر
//    منفصل وخارج نطاق هذا التنظيف).
// ==========================================================================
window.checkRequestQuotaOrAlert = async function (userId, popupRef) {
    try {
        const baseUrl = window.location.origin + '/';
        const res = await fetch(baseUrl + 'api/check-request-limit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_id: userId })
        });
        const data = await res.json();

        if (data && data.allowed === false) {
            if (popupRef && !popupRef.closed) popupRef.close();
            const periodLabels = { daily: 'اليوم', weekly: 'هذا الأسبوع', monthly: 'هذا الشهر' };
            const periodText = periodLabels[data.period] || 'هذه الفترة';
            if (window.toast) {
                window.toast(`⛔ لقد تجاوزت الحد المسموح من الطلبات (${data.limit}) ${periodText}. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.`, 'warning', 6000);
            } else {
                alert(`⛔ لقد تجاوزت الحد المسموح من الطلبات (${data.limit}) ${periodText}. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.`);
            }
            return { allowed: false };
        }
        return { allowed: true };
    } catch (err) {
        // فشل الفحص لأي سبب (شبكة/سيرفر) => لا نمنع المستخدم من استخدام الخدمة الأساسية (Fail-open)
        console.warn('تعذر التحقق من حد الطلبات، سيتم السماح بالطلب:', err.message);
        return { allowed: true };
    }
};

// ==========================================================================
// 3) تحويل الرموز الخاصة لصيغة XML آمنة - كانت مكررة بـ 4 نسخ شبه متطابقة في
//    edit-core.js, edit-wfs.js, editPolygons.js, editLines.js.
// ==========================================================================
window.escapeXml = function (unsafe) {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe).trim().replace(/[<>&"']/g, (ch) => ({
        '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
    }[ch]));
};

// ==========================================================================
// 4) تفعيل/تعطيل الزووم بالنقر المزدوج على الخريطة - كانت مكررة حرفياً في
//    measure.js و editPolygons.js. تُستخدم أثناء رسم الأشكال (خط/مضلع) لمنع
//    تعارض النقر المزدوج لإنهاء الرسم مع الزووم الافتراضي لـ OpenLayers.
// ==========================================================================
window.toggleDoubleClickZoom = function (map, active) {
    if (!map) return;
    map.getInteractions().forEach(function (interaction) {
        if (interaction instanceof ol.interaction.DoubleClickZoom) {
            interaction.setActive(active);
        }
    });
};

// ==========================================================================
// 5) [عرض ذكي لأزرار التواصل]: كاش خفيف يخزّن أي معالم خدمات مرتبطة فعلياً
//    بحسابات مزودين مُفعّلين. يُستخدم من popup.js و no-map-search.js لتقرير
//    عرض "طلب الخدمة" (إذا مرتبط) أو "اتصال + واتساب" (إذا غير مرتبط، تماماً
//    كما بالعقارات). يُحدَّث تلقائياً عند تحميل الصفحة وكل دقيقة بعدها لضمان
//    التقاط أي ربط/فك ربط جديد يقوم به المشرف من لوحة إدارة المستخدمين.
// ==========================================================================
window.providerLinkedFeaturesCache = {};

window.refreshProviderLinkedFeatures = async function () {
    try {
        const res = await fetch(window.location.origin + '/api/provider-linked-features');
        const data = await res.json();
        if (data && data.success && data.linked) {
            const newCache = {};
            Object.keys(data.linked).forEach(layer => {
                newCache[layer] = new Set((data.linked[layer] || []).map(id => String(id)));
            });
            window.providerLinkedFeaturesCache = newCache;
        }
    } catch (e) {
        console.warn('تعذر تحديث قائمة مزودي الخدمة المرتبطين:', e.message);
    }
};

// layerDbName: اسم الطبقة الخام بقاعدة البيانات (بدون "Layer")، featureId: رقم المعلم
window.isFeatureLinkedToProvider = function (layerDbName, featureId) {
    if (!layerDbName || featureId === undefined || featureId === null || featureId === '') return false;
    const set = window.providerLinkedFeaturesCache[layerDbName];
    if (!set) return false;
    return set.has(String(featureId));
};

(function () {
    function startProviderLinksPolling() {
        window.refreshProviderLinkedFeatures();
        setInterval(window.refreshProviderLinkedFeatures, 60000);
    }
    if (document.readyState !== 'loading') {
        startProviderLinksPolling();
    } else {
        document.addEventListener('DOMContentLoaded', startProviderLinksPolling);
    }
})();