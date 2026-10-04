/**
 * layer-visibility.js
 * مصدر الحقيقة الوحيد لإخفاء الطبقات على مستوى السيرفر.
 *
 * يقرأ MAP_CONFIG.globalExclusions مباشرة من ملف الواجهة js/config.js (نفس
 * القائمة التي تستخدمها الواجهة) ويعيد تحميلها تلقائياً عند تعديل الملف، حتى
 * تختفي أي طبقة مخفية من كل مكان: الخريطة (بروكسي GeoServer)، واجهات البحث
 * (/api/search-features ...)، الإحصائيات، التقييمات، وصفحات إدارة الإعلانات.
 * بدون هذا كان الإخفاء تجميلياً فقط بالمتصفح وبيانات الطبقة المخفية تبقى
 * متاحة لأي شخص يفتح أدوات المطور أو يستدعي الـ API مباشرة.
 */
import fs from 'fs';
import vm from 'vm';

// نفس جدول الأسماء المستعارة المستخدم بالواجهة (shared-utils.js → isLayerGloballyExcluded)
const REAL_ESTATE_ALIASES = {
    rentLayer: ['ApartRent', 'rent', 'شقق الإيجار', 'شقق للايجار'],
    saleLayer: ['ApartSale', 'sale', 'شقق للبيع'],
    landLayer: ['LandSale', 'land', 'الأراضي للبيع', 'اراضي للبيع', 'أرض للبيع']
};

// الطبقات المساعدة: المعرّف الداخلي بالواجهة ↔ اسم الجدول/WFS
const HELPER_ALIASES = {
    cityLayer: ['City'],
    locationLayer: ['Location'],
    roadsLayer: ['RoadsTest'],
    governorateLayer: ['Governorate']
};

const ALL_ALIASES = { ...REAL_ESTATE_ALIASES, ...HELPER_ALIASES };

function identifiersOf(value) {
    const raw = String(value || '').trim();
    if (!raw) return new Set();
    const lower = raw.toLocaleLowerCase();
    const values = new Set([lower, raw.replace(/Layer$/i, '').toLocaleLowerCase()]);
    Object.keys(ALL_ALIASES).forEach((internalKey) => {
        const aliases = [internalKey, internalKey.replace(/Layer$/i, '')].concat(ALL_ALIASES[internalKey]);
        if (aliases.some(alias => String(alias).trim().toLocaleLowerCase() === lower)) {
            aliases.forEach(alias => values.add(String(alias).trim().toLocaleLowerCase()));
        }
    });
    return values;
}

/** يقرأ globalExclusions من نص config.js بتنفيذه داخل sandbox معزول بدون أي صلاحيات */
export function parseExclusionsFromConfigSource(source) {
    const sandbox = { window: { location: { origin: 'http://localhost' } }, Object, console: { log() {}, warn() {} } };
    vm.createContext(sandbox);
    vm.runInContext(`${source}\n;globalThis.__cfg = (typeof MAP_CONFIG !== 'undefined') ? MAP_CONFIG : null;`, sandbox, { timeout: 500 });
    const cfg = sandbox.__cfg;
    if (!cfg || !Array.isArray(cfg.globalExclusions)) return [];
    return cfg.globalExclusions.map(v => String(v).trim()).filter(Boolean);
}

export function createLayerVisibility(configPath, { checkIntervalMs = 5000, logger = console } = {}) {
    let exclusions = [];
    let excludedIds = new Set();
    let lastMtime = 0;
    let lastCheck = 0;

    function load(force = false) {
        const now = Date.now();
        if (!force && now - lastCheck < checkIntervalMs) return;
        lastCheck = now;
        try {
            const stat = fs.statSync(configPath);
            if (!force && stat.mtimeMs === lastMtime) return;
            const list = parseExclusionsFromConfigSource(fs.readFileSync(configPath, 'utf8'));
            exclusions = list;
            excludedIds = new Set();
            list.forEach(item => identifiersOf(item).forEach(id => excludedIds.add(id)));
            lastMtime = stat.mtimeMs;
            logger.log(`🙈 [Layer visibility] تم تحميل ${list.length} طبقة مخفية من config.js`);
        } catch (err) {
            // عند الفشل نُبقي آخر قائمة صالحة (لا نُظهر طبقات مخفية بسبب خطأ قراءة)
            logger.warn('⚠️ [Layer visibility] تعذر قراءة config.js:', err.message);
        }
    }

    load(true);

    function isHidden(layerName) {
        load();
        if (!layerName) return false;
        const name = String(layerName).includes(':') ? String(layerName).split(':').pop() : String(layerName);
        for (const id of identifiersOf(name)) {
            if (excludedIds.has(id)) return true;
        }
        return false;
    }

    function list() {
        load();
        return exclusions.slice();
    }

    /** discriminators المخفية من قائمة معروفة (لاستخدامها بشروط SQL) */
    function hiddenFrom(candidates) {
        return (candidates || []).filter(isHidden);
    }

    return { isHidden, list, hiddenFrom, reload: () => load(true) };
}
