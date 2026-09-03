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
    const maxRetries = 3;
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const res = await fetch(window.location.origin + '/api/provider-linked-features');
            if (!res.ok) {
                throw new Error(`HTTP error! status: ${res.status}`);
            }
            const data = await res.json();
            if (data && data.success && data.linked) {
                const newCache = {};
                Object.keys(data.linked).forEach(layer => {
                    newCache[layer] = new Set((data.linked[layer] || []).map(id => String(id)));
                });
                window.providerLinkedFeaturesCache = newCache;
                return; // نجاح
            }
        } catch (e) {
            retryCount++;
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // تأخير متزايد
            } else {
                console.warn('تعذر تحديث قائمة مزودي الخدمة المرتبطين بعد عدة محاولات:', e.message);
            }
        }
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

// ==========================================================================
// 6) [حواجز الطرق]: ترجمة قيمة عمود Stop الرقمية إلى نص ولون موحّد، تُستخدم
//    من popup.js (البوب أب بالخريطة) و no-map-search.js (صفحة البحث بدون خريطة)
//    حتى لا يتكرر نفس المنطق بمكانين. القيم: 0 مفتوح، 1 مغلق، 2 أزمة خفيفة،
//    3 أزمة خانقة، 4 تفتيش.
// ==========================================================================
window.getCaseInsensitiveProp = function (obj, keyName) {
    if (!obj) return undefined;
    if (obj[keyName] !== undefined) return obj[keyName];
    const foundKey = Object.keys(obj).find(k => k.toLowerCase() === keyName.toLowerCase());
    return foundKey !== undefined ? obj[foundKey] : undefined;
};

window.getRoadBarrierStopInfo = function (rawStopValue) {
    const val = parseInt(rawStopValue, 10);
    const map = {
        0: { label: 'مفتوح',      color: '#28a745', icon: '🟢' }, // أخضر
        1: { label: 'مغلق',       color: '#dc3545', icon: '🔴' }, // أحمر
        2: { label: 'أزمة خفيفة', color: '#f39c12', icon: '🟠' }, // برتقالي
        3: { label: 'أزمة خانقة', color: '#8b0000', icon: '🟤' }, // أحمر داكن
        4: { label: 'تفتيش وأزمة خانقة',      color: '#6f42c1', icon: '🟣' }  // بنفسجي
    };
    return map[val] || { label: 'غير معروف', color: '#6c757d', icon: '⚪' };
};

// ==========================================================================
// 7) [محطات الوقود]: عرض توفر ديزل/بنزين95/بنزين98 كصفوف ملوّنة تحت الاسم.
//    القيمة 0 = متوفر (أخضر ✔️)، أي قيمة غير 0 (عادة 1) = غير متوفر (أحمر ❌).
//    تُستخدم من popup.js (البوب أب بالخريطة) و no-map-search.js.
// ==========================================================================
window.getFuelAvailabilityInfo = function (rawValue) {
    const val = parseInt(rawValue, 10);
    if (val === 0) {
        return { color: '#28a745', icon: '✔️' }; // أخضر
    }
    return { color: '#dc3545', icon: '❌' }; // أحمر
};

window.buildFuelAvailabilityHtml = function (props) {
    const fuels = [
        { key: 'diesel',   label: 'ديزل' },
        { key: 'banzen95', label: 'بنزين 95' },
        { key: 'banzen98', label: 'بنزين 98' }
    ];
    let html = '<div style="display:flex; flex-direction:column; gap:5px; margin:8px 0;">';
    fuels.forEach(f => {
        const rawVal = window.getCaseInsensitiveProp(props, f.key);
        const info = window.getFuelAvailabilityInfo(rawVal);
        html += `<div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:bold; color:${info.color};">
            <span>${info.icon}</span><span>${f.label}</span>
        </div>`;
    });
    html += '</div>';
    return html;
};

// ==========================================================================
// 8) [استثناء الطبقات المركزي]: نقطة واحدة موحّدة للتحقق مما إذا كانت أي طبقة
//    مستثناة عبر MAP_CONFIG.globalExclusions، تفهم كل الصيغ الشائعة لاسم نفس
//    الطبقة (المفتاح الداخلي 'rentLayer'، اسمها بقاعدة البيانات 'ApartRent'،
//    أو بدون كلمة Layer 'rent')، حتى يكفي كتابة أي صيغة واحدة في config.js
//    لتختفي الطبقة تلقائياً من كل الصفحات وطرق البحث (الخريطة، البحث السريع،
//    البحث الذكي، بحث الموقع، البحث بدون خريطة، البحث العالمي بالكلمات).
// ==========================================================================
window.isLayerGloballyExcluded = function (layerIdentifier) {
    if (!layerIdentifier) return false;
    const config = (typeof MAP_CONFIG !== 'undefined' && MAP_CONFIG) || window.MAP_CONFIG;
    if (!config || !Array.isArray(config.globalExclusions) || config.globalExclusions.length === 0) return false;

    const exclusions = config.globalExclusions;
    const raw = String(layerIdentifier).trim();
    const withoutLayerSuffix = raw.replace(/Layer$/i, '');

    // خريطة الأسماء البديلة لطبقات العقارات (المفتاح الداخلي <-> الاسم الفعلي بقاعدة البيانات)
    const realEstateAliasMap = { rentLayer: 'ApartRent', saleLayer: 'ApartSale', landLayer: 'LandSale' };

    const candidates = new Set([raw, withoutLayerSuffix]);
    if (realEstateAliasMap[raw]) candidates.add(realEstateAliasMap[raw]);
    Object.keys(realEstateAliasMap).forEach(function (internalKey) {
        if (realEstateAliasMap[internalKey] === raw) candidates.add(internalKey);
    });

    for (const candidate of candidates) {
        if (exclusions.includes(candidate)) return true;
    }
    return false;
};

// ==========================================================================
// 9) [نسخ رابط نتائج البحث]: حفظ آخر عملية بحث ناجحة من أي من أدوات البحث
// الثلاث (البحث الذكي، البحث السريع، البحث من خلال الموقع) بشكل موحّد لبناء
// رابط مشاركة يُعيد تنفيذ نفس البحث تلقائياً عند فتحه من متصفح/جهاز آخر.
// ==========================================================================
window.__lastResultsShareState = null;

window.setResultsShareState = function (state) {
    window.__lastResultsShareState = state;
};

window.buildResultsShareLink = function () {
    if (!window.__lastResultsShareState) return null;
    try {
        const json = JSON.stringify(window.__lastResultsShareState);
        const encoded = encodeURIComponent(btoa(unescape(encodeURIComponent(json))));
        return window.location.origin + window.location.pathname + '?resultsShare=' + encoded;
    } catch (e) {
        return null;
    }
};

window.parseResultsShareParam = function () {
    try {
        const params = new URLSearchParams(window.location.search);
        const raw = params.get('resultsShare');
        if (!raw) return null;
        const json = decodeURIComponent(escape(atob(decodeURIComponent(raw))));
        return JSON.parse(json);
    } catch (e) {
        return null;
    }
};