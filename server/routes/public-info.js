// Public numbers and prices: platform stats, category counts, market rates, fuel prices.
import { SOURCE_URL as FUEL_SOURCE_URL, parseFuelPrices } from '../../lib/thefuelprice.js';
import { IS_PROD, app } from '../app.js';
import { realestatePool, servicesPool } from '../database.js';
import { PLATFORM_PROPERTY_LAYERS, PLATFORM_SERVICE_LAYERS } from '../layers.js';
import { platformStatsCache } from '../state.js';

function parseStatsExclusions(rawValue) {
    if (!rawValue) return [];
    try {
        const parsed = Array.isArray(rawValue) ? rawValue : JSON.parse(rawValue);
        return Array.isArray(parsed) ? parsed.map(value => String(value).trim()).filter(Boolean) : [];
    } catch (_) {
        return [];
    }
}

function statsLayerIsExcluded(layerName, exclusions) {
    const aliases = {
        ApartRent: ['ApartRent', 'rentLayer', 'rent'],
        ApartSale: ['ApartSale', 'saleLayer', 'sale'],
        LandSale: ['LandSale', 'landLayer', 'land']
    };
    const candidates = aliases[layerName] || [layerName];
    const normalized = new Set(exclusions.map(value => value.toLocaleLowerCase()));
    return candidates.some(value => normalized.has(value.toLocaleLowerCase()));
}

// =========================================================================
// 🆕 مسار إحصائيات المنصة العامة (صفحة البحث بدون خريطة + فوتر/تبويب الخريطة)
// عام بدون حماية (لا يحتاج تسجيل دخول) لأنه عرض أرقام إجمالية فقط بلا تفاصيل حساسة
// =========================================================================
app.get('/api/platform-stats', async (req, res) => {
    try {
        // يرسل المتصفح استثناءات config.js كي تتطابق الإحصائيات مع الطبقات الظاهرة.
        const exclusions = parseStatsExclusions(req.query.excludedLayers);
        const visiblePropertyLayers = PLATFORM_PROPERTY_LAYERS.filter(layer => !statsLayerIsExcluded(layer, exclusions));
        const visibleServiceLayers = PLATFORM_SERVICE_LAYERS.filter(layer => !statsLayerIsExcluded(layer, exclusions));
        const cacheKey = [...visiblePropertyLayers, '|', ...visibleServiceLayers].join(',');
        const cached = platformStatsCache.get(cacheKey);
        if (cached && Date.now() < cached.expiresAt) {
            return res.json({ success: true, data: cached.data });
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

        // 🆕 2) عدد المشاهدات مقسّمة حسب المصدر: زيارات الخريطة، زيارات البحث السريع،
        // وإجمالي زيارات كامل المنصة (= مجموع الاثنين). السجلات القديمة (قبل إضافة
        // عمود source_page) تُحتسب ضمن "زيارات الخريطة" افتراضياً حتى يبقى المجموع دقيقاً.
        const viewsResult = await servicesPool.query(`
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE source_page = 'quick_search') AS quick_search
            FROM "public"."map_service_stats"
        `);
        const viewsTotal = parseInt(viewsResult.rows[0].total, 10) || 0;
        const viewsQuickSearch = parseInt(viewsResult.rows[0].quick_search, 10) || 0;
        const viewsMap = Math.max(0, viewsTotal - viewsQuickSearch);

        // عدد الفئات المتاحة = العقارات والخدمات التي لم يستثنها config.js.
        const servicesCount = visiblePropertyLayers.length + visibleServiceLayers.length;

        // عدد المعالم يضم فقط الطبقات المتاحة حالياً في config.js.
        let featuresCount = 0;
        for (const layerName of visiblePropertyLayers) {
            try {
                const countRes = await realestatePool.query(`SELECT COUNT(*) FROM public."${layerName}"`);
                featuresCount += parseInt(countRes.rows[0].count, 10) || 0;
            } catch (layerErr) {
                console.warn(`⚠️ تعذر عد معالم طبقة العقار [${layerName}]:`, layerErr.message);
            }
        }
        // الخدمات موحّدة في service_all؛ نعدّ فقط discriminators المتاحة.
        if (visibleServiceLayers.length) {
            try {
                const servicesCountRes = await servicesPool.query(
                    'SELECT COUNT(*) FROM public.service_all WHERE discriminator = ANY($1::text[])',
                    [visibleServiceLayers]
                );
                featuresCount += parseInt(servicesCountRes.rows[0].count, 10) || 0;
            } catch (err) {
                console.warn('⚠️ تعذر عد معالم service_all:', err.message);
            }
        }

        const statsData = {
            usersTotal, usersAdmin, usersUser, usersProvider,
            viewsTotal, viewsMap, viewsQuickSearch,
            servicesCount, featuresCount
        };

        platformStatsCache.set(cacheKey, { data: statsData, expiresAt: Date.now() + 60000 });

        res.json({ success: true, data: statsData });
    } catch (err) {
        console.error('❌ خطأ أثناء جلب إحصائيات المنصة:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب الإحصائيات', details: IS_PROD ? undefined : err.message });
    }
});


// =========================================================================
// 📊 عدد الإعلانات المعروضة لكل نوع (أرقام كروت الأقسام في صفحة البحث)
// عام ومكاشّ 60 ثانية مثل platform-stats. يعدّ نفس ما يعرضه البحث للزائر (status = 0 AND auto_status = 0).
// الاستجابة: { success, data: { counts: { ApartRent: n, ..., <discriminator>: n } } }
// =========================================================================
let categoryCountsCache = { data: null, expiresAt: 0 };

app.get('/api/category-counts', async (req, res) => {
    try {
        if (categoryCountsCache.data && Date.now() < categoryCountsCache.expiresAt) {
            return res.json({ success: true, data: categoryCountsCache.data });
        }
        const counts = {};
        for (const layerName of ['ApartRent', 'ApartSale', 'LandSale']) {
            try {
                const r = await realestatePool.query(
                    `SELECT COUNT(*) FROM public."${layerName}" WHERE status = 0 AND auto_status = 0`
                );
                counts[layerName] = parseInt(r.rows[0].count, 10) || 0;
            } catch (layerErr) {
                console.warn(`⚠️ تعذر عد إعلانات [${layerName}]:`, layerErr.message);
            }
        }
        const services = await servicesPool.query(`
            SELECT discriminator, COUNT(*) AS count
            FROM public.service_all
            WHERE status = 0 AND auto_status = 0
            GROUP BY discriminator
        `);
        services.rows.forEach(row => { counts[row.discriminator] = parseInt(row.count, 10) || 0; });

        const data = { counts };
        categoryCountsCache = { data, expiresAt: Date.now() + 60000 };
        res.json({ success: true, data });
    } catch (err) {
        console.error('❌ خطأ أثناء عدّ إعلانات الأقسام:', err.message);
        res.status(500).json({ success: false, error: 'فشل جلب البيانات', details: IS_PROD ? undefined : err.message });
    }
});

// =========================================================================
// 💱 أسعار السوق العالمية (عملات + ذهب + فضة) من مصادر خارجية مجانية بلا مفتاح، مكاشّة بالسيرفر
// لماذا من السيرفر: زائر المنصة لا يُرسل عنوانه لطرف ثالث، ولا نعتمد على CORS/حدود الطلب لكل متصفح، وإذا تعطّل المصدر نُرجع آخر نسخة ناجحة.
// الكاش 6.5 دقيقة لأن العميل يسحب كل 7 دقائق: كل سحبة تصل إلى نسخة جديدة (لا سحبتان متتاليتان على نفس النسخة).
// المصادر: open.er-api.com (أسعار الصرف، تحديث يومي) و api.gold-api.com (الذهب والفضة بالدولار للأونصة، لحظي).
// كل مصدر مستقل: فشل أحدهما يترك جزأه null (أو آخر قيمة ناجحة). asOf = وقت المصدر نفسه لا وقت جلبنا.
// الاستجابة: { success, data: { rates: { USD_ILS, JOD_ILS, EUR_ILS, asOf } | null,
//   gold: { usdPerOunce, ilsPerGram24, ilsPerGram21, ilsPerGram18, asOf } | null, silver: { usdPerOunce, asOf } | null, updatedAt } }
// =========================================================================
let marketRatesCache = { data: null, expiresAt: 0, cachedAt: 0 };
const TROY_OUNCE_GRAMS = 31.1035;
const LIVE_CACHE_MS = 6.5 * 60 * 1000;

async function fetchJsonWithTimeout(url, ms = 8000) {
    const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { Accept: 'application/json' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
}

// ?fresh=1 (زر «تحديث الكل» في الواجهة) يتجاوز الكاش، لكن فقط إذا مضت دقيقة على آخر قراءة من المصدر (حماية المصادر من الإغراق)
const wantsFresh = (req, cachedAt) => req.query.fresh === '1' && Date.now() - cachedAt >= 60 * 1000;

app.get('/api/market-rates', async (req, res) => {
    if (marketRatesCache.data && Date.now() < marketRatesCache.expiresAt && !wantsFresh(req, marketRatesCache.cachedAt)) {
        return res.json({ success: true, data: marketRatesCache.data });
    }
    const [fx, gold, silver] = await Promise.allSettled([
        fetchJsonWithTimeout('https://open.er-api.com/v6/latest/USD'),
        fetchJsonWithTimeout('https://api.gold-api.com/price/XAU'),
        fetchJsonWithTimeout('https://api.gold-api.com/price/XAG'),
    ]);
    const num = v => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null);
    const iso = v => { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d.toISOString(); };

    let rates = null;
    let usdIls = null;
    if (fx.status === 'fulfilled' && fx.value && fx.value.rates) {
        const { ILS, JOD, EUR } = fx.value.rates;
        usdIls = num(ILS);
        if (usdIls && num(JOD) && num(EUR)) {
            rates = {
                USD_ILS: usdIls, JOD_ILS: usdIls / Number(JOD), EUR_ILS: usdIls / Number(EUR),
                asOf: fx.value.time_last_update_unix ? new Date(fx.value.time_last_update_unix * 1000).toISOString() : null,
            };
        }
    } else if (fx.status === 'rejected') {
        console.warn('⚠️ تعذر جلب أسعار الصرف:', fx.reason && fx.reason.message);
    }

    let goldData = null;
    if (gold.status === 'fulfilled') {
        const usdPerOunce = num(gold.value && gold.value.price);
        if (usdPerOunce) {
            const perGram24 = usdPerOunce / TROY_OUNCE_GRAMS * usdIls;
            // بالشيقل فقط إذا توفّر سعر الصرف؛ العيار = جزء من الخالص (21/24، 18/24)
            goldData = {
                usdPerOunce,
                ilsPerGram24: usdIls ? perGram24 : null,
                ilsPerGram21: usdIls ? perGram24 * 21 / 24 : null,
                ilsPerGram18: usdIls ? perGram24 * 18 / 24 : null,
                asOf: iso(gold.value.updatedAt),
            };
        }
    } else {
        console.warn('⚠️ تعذر جلب سعر الذهب:', gold.reason && gold.reason.message);
    }

    let silverData = null;
    if (silver.status === 'fulfilled' && num(silver.value && silver.value.price)) {
        silverData = { usdPerOunce: num(silver.value.price), asOf: iso(silver.value.updatedAt) };
    } else if (silver.status === 'rejected') {
        console.warn('⚠️ تعذر جلب سعر الفضة:', silver.reason && silver.reason.message);
    }

    if (!rates && !goldData && !silverData) {
        // كل المصادر فشلت: آخر نسخة ناجحة إن وُجدت (حتى لو منتهية)، وإلا 502
        if (marketRatesCache.data) return res.json({ success: true, data: marketRatesCache.data });
        return res.status(502).json({ success: false, error: 'تعذر جلب أسعار السوق' });
    }
    // جزء فشل هذه المرة يُؤخذ من آخر نسخة ناجحة إن وُجدت؛ والنسخة الناقصة تُكاشّ دقيقة فقط ثم نعيد المحاولة
    const previous = marketRatesCache.data;
    const data = {
        rates: rates || (previous && previous.rates) || null,
        gold: goldData || (previous && previous.gold) || null,
        silver: silverData || (previous && previous.silver) || null,
        updatedAt: new Date().toISOString(),
    };
    const complete = !!(rates && goldData && silverData);
    marketRatesCache = { data, expiresAt: Date.now() + (complete ? LIVE_CACHE_MS : 60 * 1000), cachedAt: Date.now() };
    res.json({ success: true, data });
});

// =========================================================================
// ⛽ أسعار المحروقات من thefuelprice.com (قراءة الصفحة من السيرفر، تحليل صارم في lib/thefuelprice.js)
// لا يوجد API رسمي للأسعار؛ الصفحة تُعرض للعموم و robots.txt يسمح بها. نكاشّ 6.5 دقيقة فلا نزيد على طلب واحد لكل هذه المدة،
// ونعرّف أنفسنا بوضوح. صفحة تغيّر شكلها أو أرقام غير منطقية = فشل (نبقي آخر أسعار ناجحة، وإلا 502 والواجهة تعود لأرقام الإدارة).
// الاستجابة: { success, data: { items: [{ key, value, previous, unit: 'liter'|'cylinder', effectiveFrom }], sourceUpdatedOn, source, fetchedAt } }
// =========================================================================
let fuelPricesCache = { data: null, expiresAt: 0, cachedAt: 0 };

app.get('/api/fuel-prices', async (req, res) => {
    if (fuelPricesCache.data && Date.now() < fuelPricesCache.expiresAt && !wantsFresh(req, fuelPricesCache.cachedAt)) {
        return res.json({ success: true, data: fuelPricesCache.data });
    }
    try {
        const r = await fetch(FUEL_SOURCE_URL, {
            signal: AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'PSM-Map/1.0 (fuel price reader; cached 6.5 min)', 'Accept-Language': 'ar' },
        });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const parsed = parseFuelPrices(await r.text());
        if (!parsed) throw new Error('تغيّر شكل صفحة المصدر');
        const data = { ...parsed, source: FUEL_SOURCE_URL, fetchedAt: new Date().toISOString() };
        fuelPricesCache = { data, expiresAt: Date.now() + LIVE_CACHE_MS, cachedAt: Date.now() };
        res.json({ success: true, data });
    } catch (err) {
        console.warn('⚠️ تعذر جلب أسعار المحروقات:', err.message);
        // آخر نسخة ناجحة (حتى لو منتهية) أفضل من لا شيء؛ نعيد المحاولة بعد دقيقة
        if (fuelPricesCache.data) {
            fuelPricesCache.expiresAt = Date.now() + 60 * 1000;
            fuelPricesCache.cachedAt = Date.now();
            return res.json({ success: true, data: fuelPricesCache.data });
        }
        res.status(502).json({ success: false, error: 'تعذر جلب أسعار المحروقات' });
    }
});
