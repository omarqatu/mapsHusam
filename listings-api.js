/**
 * listings-api.js
 * ---------------------------------------------------------------------------
 * وحدة "إعلاناتي" + الصور + التقييمات + قواعد التوفر + حماية بيانات الزوار.
 *
 *  1) المزود يضيف أكثر من خدمة/عقار، يعدّلها، ويرفع لها صوراً
 *     (جدول provider_listings لملكية متعددة بدل خانة واحدة بجدول users،
 *      وجدول listing_images لتخزين الصور داخل قاعدة البيانات نفسها حتى لا
 *      تُحذف مع كل نشر - النشر يستخدم robocopy /MIR الذي يمسح أي ملف غير مُدار).
 *  2) تقييم مباشر للعقارات والخدمات (listing_ratings) مع عرض تقييم الناشر
 *     (متوسط كل تقييمات إعلاناته + تقييمات طلبات الخدمة المكتملة).
 *  3) قواعد التوفر بالبحث:
 *       - الخدمة: تظهر حتى لو "غير متاحة" (خارج ساعات العمل أو status=1)
 *         لكن لا تظهر إن كانت "ملغاة" (status=2) أو منتهية الاشتراك.
 *       - العقار: لا يظهر إلا إذا كان متوفراً (status=0 و auto_status=0).
 *  4) الزائر بدون تسجيل: تُحذف أرقام التواصل من البيانات المرسلة له.
 * ---------------------------------------------------------------------------
 */
import jwt from 'jsonwebtoken';

export const LISTING_STATUS = { AVAILABLE: 0, UNAVAILABLE: 1, CANCELLED: 2 };
export const PROPERTY_LAYERS = ['ApartRent', 'ApartSale', 'LandSale'];
// خدمات يديرها المشرف فقط (لا يضيفها المزود)
const ADMIN_ONLY_SERVICES = ['road_barriers', 'fuel_stations', 'service_all'];
// حقول التواصل التي تُحجب عن الزائر غير المسجّل
export const CONTACT_FIELDS = ['phone', 'whatsapp', 'whatsapp_number', 'mobile', 'tel', 'email'];

const MAX_IMAGES_PER_LISTING = Number(process.env.MAX_IMAGES_PER_LISTING || 8);
const MAX_IMAGE_BYTES = Number(process.env.MAX_IMAGE_BYTES || 2 * 1024 * 1024);
const MAX_LISTINGS_PER_PROVIDER = Number(process.env.MAX_LISTINGS_PER_PROVIDER || 30);
const PLATFORM_TZ = process.env.PLATFORM_TIMEZONE || 'Asia/Hebron';
const IMAGE_URL_PREFIX = '/api/listing-images/';

// ---------------------------------------------------------------------------
// أدوات التوفر (تُستخدم بالبحث والبروكسي والبوب أب)
// ---------------------------------------------------------------------------
function nowInPlatformTz() {
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: PLATFORM_TZ, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    const get = (t) => parts.find(p => p.type === t)?.value;
    const hour = Number(get('hour')) % 24;
    return { date: `${get('year')}-${get('month')}-${get('day')}`, minutes: hour * 60 + Number(get('minute')) };
}

/** نفس منطق fn_check_work_hours بقاعدة البيانات لكن يُحسب لحظياً (التريجر يحسبه فقط عند الكتابة) */
export function isWithinWorkHours(workHours, nowMinutes = nowInPlatformTz().minutes) {
    if (workHours === undefined || workHours === null) return true;
    const text = String(workHours).trim();
    if (!text || /24\s*(ساعة|h|hour)/i.test(text)) return true;
    const m = text.match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
    if (!m) return true;
    const start = Number(m[1]) * 60 + Number(m[2]);
    const end = Number(m[3]) * 60 + Number(m[4]);
    if (start > 1440 || end > 1440) return true;
    if (start <= end) return nowMinutes >= start && nowMinutes <= end;
    return nowMinutes >= start || nowMinutes <= end; // عبر منتصف الليل
}

function toDateString(value) {
    if (!value) return null;
    if (value instanceof Date) {
        if (isNaN(value)) return null;
        // حقول DATE يحوّلها pg إلى منتصف الليل بالتوقيت المحلي للسيرفر
        return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
    }
    const s = String(value).slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** يرجع حالة التوفر الفعلية للمعلم الآن */
export function computeAvailability(props, now = nowInPlatformTz()) {
    const status = props.status === undefined || props.status === null || props.status === '' ? 0 : Number(props.status);
    const end = toDateString(props.end_date);
    const expired = !!(end && end < now.date);
    const cancelled = status === LISTING_STATUS.CANCELLED || expired;
    const withinHours = isWithinWorkHours(props.work_hours, now.minutes);
    const availableNow = !cancelled && status === LISTING_STATUS.AVAILABLE && withinHours;
    return { status, expired, cancelled, withinHours, availableNow };
}

/**
 * يطبّق قواعد ظهور البحث ويحدّث auto_status لحظياً.
 * يرجع null إذا كان المعلم يجب ألا يظهر إطلاقاً.
 */
export function applySearchVisibility(props, isRealEstate, now = nowInPlatformTz()) {
    const a = computeAvailability(props, now);
    if (isRealEstate) {
        // العقار غير المتوفر لا يظهر بالبحث
        if (!a.availableNow || Number(props.auto_status || 0) !== 0) return null;
        props.availability = 'available';
        return props;
    }
    if (a.cancelled) return null; // الخدمة الملغاة/المنتهية لا تظهر
    props.auto_status = a.availableNow ? 0 : 1;
    props.availability = a.availableNow ? 'available' : 'unavailable';
    return props;
}

export function stripContactFields(props) {
    if (!props || typeof props !== 'object') return props;
    let stripped = false;
    CONTACT_FIELDS.forEach((k) => {
        Object.keys(props).forEach((key) => {
            if (key.toLowerCase() === k && props[key] !== null && props[key] !== '') {
                props[key] = null;
                stripped = true;
            }
        });
    });
    if (stripped) props.contact_hidden = true;
    return props;
}

// ---------------------------------------------------------------------------
export function registerListingsApi(app, deps) {
    const {
        servicesPool, realestatePool, requireAuth, ADMIN_JWT_SECRET, getAuthStatus,
        isValidLayer, REAL_ESTATE_LAYERS, LAYER_AR_NAMES, IS_PROD, layerVisibility,
        onListingsChanged = () => {}
    } = deps;

    const poolFor = (layer) => (REAL_ESTATE_LAYERS.includes(layer) ? realestatePool : servicesPool);
    const isProperty = (layer) => PROPERTY_LAYERS.includes(layer);
    const errDetails = (err) => (IS_PROD ? undefined : err.message);

    // كل الطبقات المعروفة بالاسم القانوني (للتطبيع من lowercase / "services:xLayer")
    const CANONICAL = new Map();
    Object.keys(LAYER_AR_NAMES).forEach(k => { if (isValidLayer(k)) CANONICAL.set(k.toLowerCase(), k); });
    PROPERTY_LAYERS.forEach(k => CANONICAL.set(k.toLowerCase(), k));
    // أسماء الواجهة المختصرة للعقارات (rentLayer → rent)
    [['rent', 'ApartRent'], ['sale', 'ApartSale'], ['land', 'LandSale']].forEach(([alias, layer]) => CANONICAL.set(alias, layer));
    function canonicalLayer(raw) {
        if (!raw) return null;
        const base = String(raw).trim().replace(/^.*:/, '').replace(/Layer$/i, '');
        return CANONICAL.get(base.toLowerCase()) || null;
    }

    function serviceCatalog() {
        return Object.keys(LAYER_AR_NAMES)
            .filter(k => isValidLayer(k) && !REAL_ESTATE_LAYERS.includes(k) && !ADMIN_ONLY_SERVICES.includes(k))
            .filter(k => !layerVisibility.isHidden(k))
            .map(k => ({ layer: k, name: LAYER_AR_NAMES[k] }));
    }
    function propertyCatalog() {
        return PROPERTY_LAYERS.filter(k => !layerVisibility.isHidden(k)).map(k => ({ layer: k, name: LAYER_AR_NAMES[k] || k }));
    }

    // -----------------------------------------------------------------------
    // المصادقة الاختيارية: تحدد هوية المستخدم إن وُجد توكن صالح، دون رفض الزائر
    // -----------------------------------------------------------------------
    async function resolveOptionalAuth(req) {
        if (req.auth) return req.auth;
        const header = req.headers['authorization'] || '';
        const token = header.startsWith('Bearer ') ? header.slice(7) : null;
        if (!token) return null;
        try {
            const decoded = jwt.verify(token, ADMIN_JWT_SECRET, { algorithms: ['HS256'], ignoreExpiration: true });
            const uid = Number(decoded.uid);
            if (!Number.isInteger(uid) || uid <= 0) return null;
            const status = await getAuthStatus(uid);
            if (!status.exists || !status.active || (Number(decoded.tv) || 0) !== status.tokenVersion) return null;
            return { uid, role: status.role };
        } catch (e) {
            return null;
        }
    }
    async function optionalAuth(req, res, next) {
        req.optionalAuth = await resolveOptionalAuth(req);
        next();
    }

    // -----------------------------------------------------------------------
    // المخطط
    // -----------------------------------------------------------------------
    const columnsCache = new Map();
    async function getColumns(layer) {
        const key = layer;
        const cached = columnsCache.get(key);
        if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.cols;
        const table = REAL_ESTATE_LAYERS.includes(layer) ? layer : 'service_all';
        const pool = poolFor(layer);
        const r = await pool.query(
            `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1`,
            [table]
        );
        const cols = new Map(r.rows.map(row => [row.column_name, row.data_type]));
        let geomType = 'POINT';
        try {
            const g = await pool.query(`SELECT type FROM public.geometry_columns WHERE f_table_schema = 'public' AND f_table_name = $1 AND f_geometry_column = 'geom' LIMIT 1`, [table]);
            if (g.rows[0]) geomType = String(g.rows[0].type).toUpperCase();
        } catch (e) { /* PostGIS views غير متوفرة؟ نفترض نقطة */ }
        const info = { cols, geomType, table, idField: REAL_ESTATE_LAYERS.includes(layer) ? 'fid' : 'id' };
        columnsCache.set(key, { at: Date.now(), cols: info });
        return info;
    }

    async function ensureSchema() {
        try {
            await servicesPool.query(`
                CREATE TABLE IF NOT EXISTS public.provider_listings (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    layer TEXT NOT NULL,
                    feature_id INTEGER NOT NULL,
                    source TEXT NOT NULL DEFAULT 'portal',
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE (layer, feature_id)
                )`);
            await servicesPool.query(`CREATE INDEX IF NOT EXISTS provider_listings_user_idx ON public.provider_listings (user_id)`);
            await servicesPool.query(`
                CREATE TABLE IF NOT EXISTS public.listing_images (
                    id SERIAL PRIMARY KEY,
                    layer TEXT NOT NULL,
                    feature_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    mime TEXT NOT NULL,
                    data BYTEA NOT NULL,
                    byte_size INTEGER NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW()
                )`);
            await servicesPool.query(`CREATE INDEX IF NOT EXISTS listing_images_feature_idx ON public.listing_images (layer, feature_id)`);
            await servicesPool.query(`
                CREATE TABLE IF NOT EXISTS public.listing_ratings (
                    id SERIAL PRIMARY KEY,
                    layer TEXT NOT NULL,
                    feature_id INTEGER NOT NULL,
                    user_id INTEGER NOT NULL,
                    rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
                    comment TEXT,
                    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
                    UNIQUE (layer, feature_id, user_id)
                )`);
            await servicesPool.query(`CREATE INDEX IF NOT EXISTS listing_ratings_feature_idx ON public.listing_ratings (layer, feature_id)`);

            // ترحيل الربط القديم (خانة واحدة بجدول users) إلى جدول الملكية المتعددة
            const legacy = await servicesPool.query(
                `SELECT user_id, service_layer, feature_id FROM public.users
                 WHERE role = 'provider' AND service_layer IS NOT NULL AND feature_id IS NOT NULL`
            );
            for (const row of legacy.rows) {
                const layer = canonicalLayer(row.service_layer);
                if (!layer) continue;
                await servicesPool.query(
                    `INSERT INTO public.provider_listings (user_id, layer, feature_id, source)
                     VALUES ($1, $2, $3, 'legacy') ON CONFLICT (layer, feature_id) DO NOTHING`,
                    [row.user_id, layer, row.feature_id]
                );
            }
            console.log('✅ جداول الإعلانات المتعددة والصور والتقييمات جاهزة (provider_listings, listing_images, listing_ratings)');
        } catch (err) {
            console.error('⚠️ خطأ أثناء تهيئة جداول الإعلانات:', err.message);
        }
    }
    ensureSchema();

    // -----------------------------------------------------------------------
    // الملكية
    // -----------------------------------------------------------------------
    /** مالك المعلم: من جدول الملكية أولاً ثم الربط القديم بجدول users */
    async function findOwner(layer, featureId) {
        const r = await servicesPool.query(
            `SELECT u.user_id, u.full_name, u.role, u.is_active
             FROM public.provider_listings pl JOIN public.users u ON u.user_id = pl.user_id
             WHERE pl.layer = $1 AND pl.feature_id = $2 LIMIT 1`,
            [layer, featureId]
        );
        if (r.rows[0]) return r.rows[0];
        const legacy = await servicesPool.query(
            `SELECT user_id, full_name, role, is_active, service_layer FROM public.users
             WHERE feature_id = $1 AND service_layer IS NOT NULL`,
            [featureId]
        );
        return legacy.rows.find(u => canonicalLayer(u.service_layer) === layer) || null;
    }

    async function assertCanManage(auth, layer, featureId) {
        if (auth.role === 'admin') return true;
        const owner = await findOwner(layer, featureId);
        return !!(owner && Number(owner.user_id) === Number(auth.uid));
    }

    async function requireProvider(req, res, next) {
        if (!req.auth || !['provider', 'admin'].includes(req.auth.role)) {
            return res.status(403).json({ success: false, error: 'هذه الميزة متاحة لحسابات مزودي الخدمة فقط.' });
        }
        next();
    }

    function parseLayerParam(raw) {
        const layer = canonicalLayer(raw);
        if (!layer || !isValidLayer(layer)) return null;
        return layer;
    }
    function parseId(raw) {
        const n = Number(raw);
        return Number.isSafeInteger(n) && n > 0 ? n : null;
    }

    // -----------------------------------------------------------------------
    // تنظيف الحقول القابلة للتعديل من المزود
    // -----------------------------------------------------------------------
    const cleanText = (v, max) => (v === undefined || v === null) ? null : String(v).replace(/[<>]/g, '').trim().slice(0, max) || null;
    const cleanNumber = (v) => {
        if (v === undefined || v === null || v === '') return null;
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n < 1e12 ? n : undefined;
    };
    const cleanPhone = (v) => {
        const t = cleanText(v, 30);
        if (!t) return null;
        return /^[+\d][\d\s-]{5,}$/.test(t) ? t.replace(/[\s-]/g, '') : undefined;
    };
    const cleanUrl = (v) => {
        const t = cleanText(v, 500);
        if (!t) return null;
        return /^https?:\/\//i.test(t) ? t : undefined;
    };
    const cleanHours = (v) => {
        const t = cleanText(v, 100);
        if (!t) return null;
        return t;
    };

    const FIELD_RULES = {
        name: (v) => cleanText(v, 150),
        des: (v) => cleanText(v, 2000),
        price: cleanNumber,
        area: cleanNumber,
        whatsapp: cleanPhone,
        phone: cleanPhone,
        work_hours: cleanHours,
        search_tags: (v) => cleanText(v, 300),
        video: cleanUrl,
        details_link_1: cleanUrl,
        details_link_2: cleanUrl,
        currency: (v) => { const t = cleanText(v, 5); return !t ? null : (['USD', 'ILS', 'JOD'].includes(t.toUpperCase()) ? t.toUpperCase() : undefined); },
        rooms: cleanNumber,
        floor: cleanNumber
    };
    const FIELD_LABELS = { name: 'الاسم', des: 'الوصف', price: 'السعر', area: 'المساحة', whatsapp: 'رقم الواتساب', phone: 'رقم الهاتف', video: 'رابط الفيديو', details_link_1: 'رابط التفاصيل', details_link_2: 'رابط التفاصيل', currency: 'العملة', rooms: 'عدد الغرف', floor: 'الطابق' };

    function collectFields(body, cols) {
        const out = {};
        for (const [field, rule] of Object.entries(FIELD_RULES)) {
            if (!(field in body) || !cols.has(field)) continue;
            const value = rule(body[field]);
            if (value === undefined) throw Object.assign(new Error(`قيمة غير صالحة لحقل ${FIELD_LABELS[field] || field}.`), { status: 400 });
            out[field] = value;
        }
        if ('status' in body) {
            const s = Number(body.status);
            if (![0, 1, 2].includes(s)) throw Object.assign(new Error('الحالة يجب أن تكون: 0 متاح، 1 غير متاح، 2 ملغي.'), { status: 400 });
            if (cols.has('status')) out.status = s;
        }
        return out;
    }

    function parseCoords(body) {
        if (body.x_coord === undefined && body.y_coord === undefined) return null;
        const x = Number(body.x_coord), y = Number(body.y_coord);
        // EPSG:28191 تقريباً لفلسطين: x ≈ 100k-300k و y ≈ 50k-300k (مع هامش)
        if (!Number.isFinite(x) || !Number.isFinite(y) || x < 50000 || x > 400000 || y < 0 || y > 1500000) {
            throw Object.assign(new Error('الإحداثيات غير صالحة، يرجى اختيار الموقع على الخريطة.'), { status: 400 });
        }
        return { x, y };
    }

    /** تعبير الهندسة المناسب لنوع عمود geom (نقطة، أو مضلع صغير حول النقطة للأراضي) */
    function geomSql(geomType, xParam, yParam, areaParam) {
        const point = `ST_SetSRID(ST_MakePoint(${xParam}, ${yParam}), 28191)`;
        if (geomType.includes('POLYGON')) {
            // نصف ضلع مربع مساحته = المساحة المدخلة (افتراضي 20م × 20م)
            const half = `GREATEST(5, LEAST(500, SQRT(COALESCE(NULLIF((${areaParam})::float8, 0), 400)) / 2))`;
            const poly = `ST_Expand(${point}, ${half})`;
            return geomType.startsWith('MULTI') ? `ST_Multi(${poly})` : poly;
        }
        return geomType.startsWith('MULTI') ? `ST_Multi(${point})` : point;
    }

    function rowToListing(layer, row) {
        const avail = computeAvailability(row);
        return {
            layer,
            layer_name: LAYER_AR_NAMES[layer] || layer,
            kind: isProperty(layer) ? 'property' : 'service',
            feature_id: row.fid ?? row.id,
            name: row.name ?? null,
            des: row.des ?? null,
            price: row.price ?? null,
            area: row.area ?? null,
            currency: row.currency ?? null,
            rooms: row.rooms ?? null,
            floor: row.floor ?? null,
            whatsapp: row.whatsapp ?? null,
            phone: row.phone ?? null,
            work_hours: row.work_hours ?? null,
            search_tags: row.search_tags ?? null,
            video: row.video ?? null,
            details_link_1: row.details_link_1 ?? null,
            details_link_2: row.details_link_2 ?? null,
            status: avail.status,
            end_date: toDateString(row.end_date),
            expired: avail.expired,
            available_now: avail.availableNow,
            location_name: row.location_name ?? row.location ?? null,
            gov_a: row.gov_a ?? null,
            village_a: row.village_a ?? null,
            x_coord: row.x_coord !== undefined && row.x_coord !== null ? Number(row.x_coord) : (row.cx !== undefined ? Number(row.cx) : null),
            y_coord: row.y_coord !== undefined && row.y_coord !== null ? Number(row.y_coord) : (row.cy !== undefined ? Number(row.cy) : null),
            hidden_layer: layerVisibility.isHidden(layer)
        };
    }

    async function loadFeatureRow(layer, featureId) {
        const info = await getColumns(layer);
        const discWhere = info.table === 'service_all' ? ' AND discriminator = $2' : '';
        const params = info.table === 'service_all' ? [featureId, layer] : [featureId];
        const r = await poolFor(layer).query(
            `SELECT *, ST_X(ST_PointOnSurface(geom)) AS cx, ST_Y(ST_PointOnSurface(geom)) AS cy
             FROM public."${info.table}" WHERE ${info.idField} = $1${discWhere} LIMIT 1`,
            params
        );
        return r.rows[0] || null;
    }

    async function syncPicColumn(layer, featureId) {
        try {
            const info = await getColumns(layer);
            if (!info.cols.has('pic')) return;
            const first = await servicesPool.query(
                `SELECT id FROM public.listing_images WHERE layer = $1 AND feature_id = $2 ORDER BY sort_order, id LIMIT 1`,
                [layer, featureId]
            );
            const newPic = first.rows[0] ? `${IMAGE_URL_PREFIX}${first.rows[0].id}` : null;
            const discWhere = info.table === 'service_all' ? ' AND discriminator = $3' : '';
            const params = info.table === 'service_all' ? [newPic, featureId, layer] : [newPic, featureId];
            // لا نستبدل رابط صورة خارجي أدخله المشرف يدوياً
            await poolFor(layer).query(
                `UPDATE public."${info.table}" SET pic = $1
                 WHERE ${info.idField} = $2${discWhere} AND (pic IS NULL OR pic = '' OR pic LIKE '${IMAGE_URL_PREFIX}%')`,
                params
            );
        } catch (err) {
            console.warn('⚠️ تعذر مزامنة عمود pic:', err.message);
        }
    }

    // -----------------------------------------------------------------------
    // 1) مسارات "إعلاناتي"
    // -----------------------------------------------------------------------
    app.get('/api/my-listings/catalog', requireAuth, requireProvider, (req, res) => {
        res.json({ success: true, services: serviceCatalog(), properties: propertyCatalog(), limits: { maxImages: MAX_IMAGES_PER_LISTING, maxImageBytes: MAX_IMAGE_BYTES, maxListings: MAX_LISTINGS_PER_PROVIDER } });
    });

    app.get('/api/my-listings', requireAuth, requireProvider, async (req, res) => {
        try {
            const kind = req.query.kind === 'property' ? 'property' : (req.query.kind === 'service' ? 'service' : null);
            const owned = await servicesPool.query(
                `SELECT layer, feature_id, source FROM public.provider_listings WHERE user_id = $1 ORDER BY created_at DESC`,
                [req.auth.uid]
            );
            const imageCounts = await servicesPool.query(
                `SELECT layer, feature_id, COUNT(*)::int AS n, MIN(id) AS first_id FROM public.listing_images WHERE user_id = $1 GROUP BY layer, feature_id`,
                [req.auth.uid]
            );
            const imgMap = new Map(imageCounts.rows.map(r => [`${r.layer}:${r.feature_id}`, r]));
            const items = [];
            for (const row of owned.rows) {
                if (kind && (kind === 'property') !== isProperty(row.layer)) continue;
                try {
                    const feature = await loadFeatureRow(row.layer, row.feature_id);
                    if (!feature) continue;
                    const item = rowToListing(row.layer, feature);
                    const img = imgMap.get(`${row.layer}:${row.feature_id}`);
                    item.images_count = img ? img.n : 0;
                    item.cover = img ? `${IMAGE_URL_PREFIX}${img.first_id}` : null;
                    item.is_primary = row.source === 'legacy';
                    items.push(item);
                } catch (e) {
                    console.warn(`⚠️ تعذر تحميل الإعلان ${row.layer}:${row.feature_id}:`, e.message);
                }
            }
            res.json({ success: true, items });
        } catch (err) {
            console.error('❌ خطأ أثناء جلب إعلانات المزود:', err.message);
            res.status(500).json({ success: false, error: 'فشل جلب الإعلانات', details: errDetails(err) });
        }
    });

    app.get('/api/my-listings/:layer/:fid', requireAuth, requireProvider, async (req, res) => {
        const layer = parseLayerParam(req.params.layer);
        const fid = parseId(req.params.fid);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'معرّف الإعلان غير صالح.' });
        try {
            if (!(await assertCanManage(req.auth, layer, fid))) return res.status(403).json({ success: false, error: 'هذا الإعلان غير مرتبط بحسابك.' });
            const feature = await loadFeatureRow(layer, fid);
            if (!feature) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
            const images = await servicesPool.query(
                `SELECT id, byte_size, sort_order FROM public.listing_images WHERE layer = $1 AND feature_id = $2 ORDER BY sort_order, id`,
                [layer, fid]
            );
            const info = await getColumns(layer);
            res.json({
                success: true,
                item: rowToListing(layer, feature),
                images: images.rows.map(r => ({ id: r.id, url: `${IMAGE_URL_PREFIX}${r.id}`, size: r.byte_size })),
                editable_fields: Object.keys(FIELD_RULES).filter(f => info.cols.has(f)).concat(info.cols.has('status') ? ['status'] : [])
            });
        } catch (err) {
            res.status(500).json({ success: false, error: 'فشل جلب الإعلان', details: errDetails(err) });
        }
    });

    app.post('/api/my-listings', requireAuth, requireProvider, async (req, res) => {
        const layer = parseLayerParam(req.body.layer);
        if (!layer) return res.status(400).json({ success: false, error: 'يرجى اختيار تصنيف صالح.' });
        if (layerVisibility.isHidden(layer)) return res.status(403).json({ success: false, error: 'هذا التصنيف غير متاح حالياً على المنصة.' });
        if (!isProperty(layer) && ADMIN_ONLY_SERVICES.includes(layer)) return res.status(403).json({ success: false, error: 'هذا التصنيف يديره المشرف فقط.' });
        try {
            const count = await servicesPool.query('SELECT COUNT(*)::int AS n FROM public.provider_listings WHERE user_id = $1', [req.auth.uid]);
            if (req.auth.role !== 'admin' && count.rows[0].n >= MAX_LISTINGS_PER_PROVIDER) {
                return res.status(400).json({ success: false, error: `وصلت للحد الأقصى من الإعلانات (${MAX_LISTINGS_PER_PROVIDER}).` });
            }
            const info = await getColumns(layer);
            const fields = collectFields(req.body, info.cols);
            const coords = parseCoords(req.body);
            if (!coords) return res.status(400).json({ success: false, error: 'يرجى تحديد موقع الإعلان على الخريطة.' });
            if (!fields.name) return res.status(400).json({ success: false, error: 'الاسم مطلوب.' });
            if (!fields.whatsapp && !fields.phone) return res.status(400).json({ success: false, error: 'يرجى إدخال رقم واتساب أو هاتف للتواصل.' });
            if (fields.status === undefined && info.cols.has('status')) fields.status = 0;
            if (fields.whatsapp) fields.whatsapp = normalizeWhatsapp(fields.whatsapp);

            const names = [];
            const values = [];
            const params = [];
            const add = (col, val) => { params.push(val); names.push(`"${col}"`); values.push(`$${params.length}`); };
            Object.entries(fields).forEach(([k, v]) => add(k, v));
            if (info.table === 'service_all') add('discriminator', layer);
            if (info.cols.has('auto_status')) add('auto_status', fields.status === 0 ? 0 : 1);
            if (info.cols.has('start_date')) { names.push('"start_date"'); values.push('CURRENT_DATE'); }
            params.push(coords.x); const xp = `$${params.length}`;
            params.push(coords.y); const yp = `$${params.length}`;
            const isPolygon = info.geomType.includes('POLYGON');
            const areaParam = isPolygon && fields.area !== undefined && fields.area !== null ? (params.push(fields.area), `$${params.length}`) : 'NULL';
            names.push('"geom"'); values.push(geomSql(info.geomType, `${xp}::float8`, `${yp}::float8`, areaParam));
            if (!info.geomType.includes('POLYGON')) {
                if (info.cols.has('x_coord')) { names.push('"x_coord"'); values.push(xp); }
                if (info.cols.has('y_coord')) { names.push('"y_coord"'); values.push(yp); }
            }
            const insert = await poolFor(layer).query(
                `INSERT INTO public."${info.table}" (${names.join(', ')}) VALUES (${values.join(', ')}) RETURNING ${info.idField} AS id`,
                params
            );
            const fid = insert.rows[0].id;
            await servicesPool.query(
                `INSERT INTO public.provider_listings (user_id, layer, feature_id, source) VALUES ($1, $2, $3, 'portal')`,
                [req.auth.uid, layer, fid]
            );
            onListingsChanged();
            console.log(`🆕 [Listings] المستخدم ${req.auth.uid} أضاف إعلاناً ${layer}:${fid}`);
            res.json({ success: true, layer, feature_id: fid });
        } catch (err) {
            if (err.status) return res.status(err.status).json({ success: false, error: err.message });
            console.error('❌ خطأ أثناء إضافة إعلان:', err.message);
            res.status(500).json({ success: false, error: 'فشل إضافة الإعلان', details: errDetails(err) });
        }
    });

    app.put('/api/my-listings/:layer/:fid', requireAuth, requireProvider, async (req, res) => {
        const layer = parseLayerParam(req.params.layer);
        const fid = parseId(req.params.fid);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'معرّف الإعلان غير صالح.' });
        try {
            if (!(await assertCanManage(req.auth, layer, fid))) return res.status(403).json({ success: false, error: 'هذا الإعلان غير مرتبط بحسابك.' });
            const info = await getColumns(layer);
            const fields = collectFields(req.body, info.cols);
            const coords = parseCoords(req.body);
            if ('name' in fields && !fields.name) return res.status(400).json({ success: false, error: 'الاسم مطلوب.' });
            if (fields.whatsapp) fields.whatsapp = normalizeWhatsapp(fields.whatsapp);

            const sets = [];
            const params = [];
            Object.entries(fields).forEach(([k, v]) => { params.push(v); sets.push(`"${k}" = $${params.length}`); });
            if ('status' in fields && info.cols.has('auto_status')) { params.push(fields.status === 0 ? 0 : 1); sets.push(`"auto_status" = $${params.length}`); }
            if (coords) {
                params.push(coords.x); const xp = `$${params.length}`;
                params.push(coords.y); const yp = `$${params.length}`;
                let areaExpr = 'NULL';
                if (info.geomType.includes('POLYGON')) {
                    if (info.cols.has('area')) areaExpr = 'area';
                    if (fields.area !== undefined && fields.area !== null) { params.push(fields.area); areaExpr = `$${params.length}`; }
                }
                sets.push(`"geom" = ${geomSql(info.geomType, `${xp}::float8`, `${yp}::float8`, areaExpr)}`);
                if (!info.geomType.includes('POLYGON')) {
                    if (info.cols.has('x_coord')) sets.push(`"x_coord" = ${xp}`);
                    if (info.cols.has('y_coord')) sets.push(`"y_coord" = ${yp}`);
                }
            }
            if (info.cols.has('updated_at')) sets.push('"updated_at" = NOW()');
            if (!sets.length) return res.status(400).json({ success: false, error: 'لا توجد تعديلات لحفظها.' });
            params.push(fid);
            let where = `${info.idField} = $${params.length}`;
            if (info.table === 'service_all') { params.push(layer); where += ` AND discriminator = $${params.length}`; }
            const r = await poolFor(layer).query(`UPDATE public."${info.table}" SET ${sets.join(', ')} WHERE ${where}`, params);
            if (r.rowCount === 0) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });

            // إبقاء نسخة الإحداثيات بجدول users متزامنة للخدمة الأساسية القديمة
            if (coords && !info.geomType.includes('POLYGON')) {
                await servicesPool.query(
                    `UPDATE public.users SET x_coord = $1, y_coord = $2 WHERE user_id = $3 AND feature_id = $4`,
                    [coords.x, coords.y, req.auth.uid, fid]
                ).catch(() => {});
            }
            onListingsChanged();
            res.json({ success: true });
        } catch (err) {
            if (err.status) return res.status(err.status).json({ success: false, error: err.message });
            console.error('❌ خطأ أثناء تعديل إعلان:', err.message);
            res.status(500).json({ success: false, error: 'فشل حفظ التعديلات', details: errDetails(err) });
        }
    });

    app.delete('/api/my-listings/:layer/:fid', requireAuth, requireProvider, async (req, res) => {
        const layer = parseLayerParam(req.params.layer);
        const fid = parseId(req.params.fid);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'معرّف الإعلان غير صالح.' });
        try {
            if (!(await assertCanManage(req.auth, layer, fid))) return res.status(403).json({ success: false, error: 'هذا الإعلان غير مرتبط بحسابك.' });
            const link = await servicesPool.query(`SELECT source FROM public.provider_listings WHERE layer = $1 AND feature_id = $2`, [layer, fid]);
            const isLegacy = !link.rows[0] || link.rows[0].source === 'legacy';
            if (isLegacy && req.auth.role !== 'admin') {
                return res.status(400).json({ success: false, error: 'هذا هو الإعلان الأساسي المرتبط بحسابك من الإدارة؛ لا يمكن حذفه، يمكنك تغيير حالته إلى "ملغي".' });
            }
            const info = await getColumns(layer);
            const params = [fid];
            let where = `${info.idField} = $1`;
            if (info.table === 'service_all') { params.push(layer); where += ' AND discriminator = $2'; }
            await poolFor(layer).query(`DELETE FROM public."${info.table}" WHERE ${where}`, params);
            await servicesPool.query(`DELETE FROM public.listing_images WHERE layer = $1 AND feature_id = $2`, [layer, fid]);
            await servicesPool.query(`DELETE FROM public.provider_listings WHERE layer = $1 AND feature_id = $2`, [layer, fid]);
            onListingsChanged();
            res.json({ success: true });
        } catch (err) {
            console.error('❌ خطأ أثناء حذف إعلان:', err.message);
            res.status(500).json({ success: false, error: 'فشل حذف الإعلان', details: errDetails(err) });
        }
    });

    // -----------------------------------------------------------------------
    // 2) الصور
    // -----------------------------------------------------------------------
    function decodeImage(dataUrl) {
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(String(dataUrl || ''));
        if (!m) return null;
        const buf = Buffer.from(m[2], 'base64');
        const mime = m[1];
        // التحقق من البصمة الحقيقية للملف (لا نثق بالنوع المعلن فقط)
        const isJpeg = buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
        const isPng = buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
        const isWebp = buf.slice(0, 4).toString('ascii') === 'RIFF' && buf.slice(8, 12).toString('ascii') === 'WEBP';
        if ((mime === 'image/jpeg' && !isJpeg) || (mime === 'image/png' && !isPng) || (mime === 'image/webp' && !isWebp)) return null;
        return { buf, mime };
    }

    app.post('/api/my-listings/:layer/:fid/images', requireAuth, requireProvider, async (req, res) => {
        const layer = parseLayerParam(req.params.layer);
        const fid = parseId(req.params.fid);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'معرّف الإعلان غير صالح.' });
        try {
            if (!(await assertCanManage(req.auth, layer, fid))) return res.status(403).json({ success: false, error: 'هذا الإعلان غير مرتبط بحسابك.' });
            const img = decodeImage(req.body && req.body.image);
            if (!img) return res.status(400).json({ success: false, error: 'صيغة الصورة غير مدعومة (JPG / PNG / WEBP فقط).' });
            if (img.buf.length > MAX_IMAGE_BYTES) return res.status(413).json({ success: false, error: `حجم الصورة أكبر من الحد المسموح (${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} ميغابايت).` });
            const count = await servicesPool.query('SELECT COUNT(*)::int AS n, COALESCE(MAX(sort_order), 0) AS mx FROM public.listing_images WHERE layer = $1 AND feature_id = $2', [layer, fid]);
            if (count.rows[0].n >= MAX_IMAGES_PER_LISTING) return res.status(400).json({ success: false, error: `الحد الأقصى ${MAX_IMAGES_PER_LISTING} صور لكل إعلان.` });
            const r = await servicesPool.query(
                `INSERT INTO public.listing_images (layer, feature_id, user_id, mime, data, byte_size, sort_order)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
                [layer, fid, req.auth.uid, img.mime, img.buf, img.buf.length, Number(count.rows[0].mx) + 1]
            );
            await syncPicColumn(layer, fid);
            res.json({ success: true, id: r.rows[0].id, url: `${IMAGE_URL_PREFIX}${r.rows[0].id}` });
        } catch (err) {
            console.error('❌ خطأ أثناء رفع صورة:', err.message);
            res.status(500).json({ success: false, error: 'فشل رفع الصورة', details: errDetails(err) });
        }
    });

    app.delete('/api/my-listings/images/:id', requireAuth, requireProvider, async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'معرّف الصورة غير صالح.' });
        try {
            const r = await servicesPool.query('SELECT layer, feature_id FROM public.listing_images WHERE id = $1', [id]);
            if (!r.rows[0]) return res.status(404).json({ success: false, error: 'الصورة غير موجودة.' });
            const { layer, feature_id } = r.rows[0];
            if (!(await assertCanManage(req.auth, layer, feature_id))) return res.status(403).json({ success: false, error: 'غير مصرح.' });
            await servicesPool.query('DELETE FROM public.listing_images WHERE id = $1', [id]);
            await syncPicColumn(layer, feature_id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: 'فشل حذف الصورة', details: errDetails(err) });
        }
    });

    // جعل صورة غلافاً (الأولى بالترتيب)
    app.post('/api/my-listings/images/:id/cover', requireAuth, requireProvider, async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ success: false, error: 'معرّف الصورة غير صالح.' });
        try {
            const r = await servicesPool.query('SELECT layer, feature_id FROM public.listing_images WHERE id = $1', [id]);
            if (!r.rows[0]) return res.status(404).json({ success: false, error: 'الصورة غير موجودة.' });
            const { layer, feature_id } = r.rows[0];
            if (!(await assertCanManage(req.auth, layer, feature_id))) return res.status(403).json({ success: false, error: 'غير مصرح.' });
            await servicesPool.query(
                `UPDATE public.listing_images SET sort_order = CASE WHEN id = $1 THEN 0 ELSE sort_order + 1 END WHERE layer = $2 AND feature_id = $3`,
                [id, layer, feature_id]
            );
            await syncPicColumn(layer, feature_id);
            res.json({ success: true });
        } catch (err) {
            res.status(500).json({ success: false, error: 'فشل تعيين صورة الغلاف', details: errDetails(err) });
        }
    });

    // عام: قائمة صور معلم + الصورة نفسها
    app.get('/api/listing-images', async (req, res) => {
        const layer = parseLayerParam(req.query.layer);
        const fid = parseId(req.query.feature_id);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'layer و feature_id مطلوبة.' });
        if (layerVisibility.isHidden(layer)) return res.json({ success: true, images: [] });
        try {
            const r = await servicesPool.query(
                `SELECT id FROM public.listing_images WHERE layer = $1 AND feature_id = $2 ORDER BY sort_order, id`,
                [layer, fid]
            );
            res.json({ success: true, images: r.rows.map(row => ({ id: row.id, url: `${IMAGE_URL_PREFIX}${row.id}` })) });
        } catch (err) {
            res.status(500).json({ success: false, error: 'فشل جلب الصور', details: errDetails(err) });
        }
    });

    app.get('/api/listing-images/:id', async (req, res) => {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).end();
        try {
            const r = await servicesPool.query('SELECT layer, mime, data FROM public.listing_images WHERE id = $1', [id]);
            const row = r.rows[0];
            if (!row || layerVisibility.isHidden(row.layer)) return res.status(404).end();
            res.setHeader('Content-Type', row.mime);
            res.setHeader('Cache-Control', 'public, max-age=86400');
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.setHeader('Content-Security-Policy', "default-src 'none'");
            res.end(row.data);
        } catch (err) {
            res.status(500).end();
        }
    });

    // -----------------------------------------------------------------------
    // 3) التقييمات
    // -----------------------------------------------------------------------
    function maskName(full) {
        const name = String(full || '').trim();
        if (!name) return 'مستخدم';
        const first = name.split(/\s+/)[0];
        return first.length > 12 ? first.slice(0, 12) + '…' : first;
    }

    async function ownerRatingSummary(ownerId) {
        const r = await servicesPool.query(`
            WITH owned AS (
                SELECT layer, feature_id FROM public.provider_listings WHERE user_id = $1
            ), all_ratings AS (
                SELECT lr.rating FROM public.listing_ratings lr
                JOIN owned o ON o.layer = lr.layer AND o.feature_id = lr.feature_id
                WHERE lr.user_id <> $1
                UNION ALL
                SELECT sr.rating FROM public.service_ratings sr WHERE sr.provider_user_id = $1
            )
            SELECT ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*)::int AS total,
                   (SELECT COUNT(*)::int FROM owned) AS listings
            FROM all_ratings`, [ownerId]);
        const row = r.rows[0] || {};
        return { average: row.avg ? Number(row.avg) : 0, total: row.total || 0, listings: row.listings || 0 };
    }

    app.get('/api/listing-ratings', optionalAuth, async (req, res) => {
        const layer = parseLayerParam(req.query.layer);
        const fid = parseId(req.query.feature_id);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'layer و feature_id مطلوبة.' });
        if (layerVisibility.isHidden(layer)) return res.status(404).json({ success: false, error: 'غير متاح.' });
        try {
            const direct = await servicesPool.query(
                `SELECT lr.user_id, lr.rating, lr.comment, lr.updated_at AS created_at, u.full_name, 'direct' AS source
                 FROM public.listing_ratings lr LEFT JOIN public.users u ON u.user_id = lr.user_id
                 WHERE lr.layer = $1 AND lr.feature_id = $2`,
                [layer, fid]
            );
            let fromRequests = { rows: [] };
            if (!isProperty(layer)) {
                fromRequests = await servicesPool.query(
                    `SELECT sr.user_id, sr.rating, sr.comment, sr.created_at, u.full_name, 'request' AS source
                     FROM public.service_ratings sr LEFT JOIN public.users u ON u.user_id = sr.user_id
                     WHERE sr.service_layer = $1 AND sr.feature_id = $2`,
                    [layer, fid]
                ).catch(() => ({ rows: [] }));
            }
            const all = direct.rows.concat(fromRequests.rows)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
            const total = all.length;
            const average = total ? Math.round((all.reduce((s, r) => s + Number(r.rating), 0) / total) * 10) / 10 : 0;
            const distribution = [1, 2, 3, 4, 5].map(star => all.filter(r => Number(r.rating) === star).length);

            const owner = await findOwner(layer, fid);
            let ownerInfo = null;
            if (owner) {
                const summary = await ownerRatingSummary(owner.user_id);
                ownerInfo = { name: owner.full_name || 'الناشر', ...summary };
            }
            const auth = req.optionalAuth;
            const mine = auth ? direct.rows.find(r => Number(r.user_id) === auth.uid) : null;
            res.json({
                success: true,
                average, total, distribution,
                ratings: all.slice(0, 50).map(r => ({
                    rating: Number(r.rating), comment: r.comment, created_at: r.created_at,
                    user_name: maskName(r.full_name), verified: r.source === 'request'
                })),
                owner: ownerInfo,
                can_rate: !!auth && !(owner && Number(owner.user_id) === auth.uid),
                is_owner: !!(auth && owner && Number(owner.user_id) === auth.uid),
                my_rating: mine ? { rating: Number(mine.rating), comment: mine.comment } : null
            });
        } catch (err) {
            console.error('❌ خطأ أثناء جلب تقييمات الإعلان:', err.message);
            res.status(500).json({ success: false, error: 'فشل جلب التقييمات', details: errDetails(err) });
        }
    });

    app.post('/api/listing-ratings', requireAuth, async (req, res) => {
        const layer = parseLayerParam(req.body.layer);
        const fid = parseId(req.body.feature_id);
        const rating = Number(req.body.rating);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'الإعلان غير صالح.' });
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ success: false, error: 'التقييم يجب أن يكون من 1 إلى 5 نجوم.' });
        if (layerVisibility.isHidden(layer)) return res.status(404).json({ success: false, error: 'غير متاح.' });
        if (['road_barriers', 'fuel_stations'].includes(layer)) return res.status(400).json({ success: false, error: 'هذا التصنيف لا يقبل التقييم.' });
        const comment = cleanText(req.body.comment, 500);
        try {
            const feature = await loadFeatureRow(layer, fid);
            if (!feature) return res.status(404).json({ success: false, error: 'الإعلان غير موجود.' });
            const owner = await findOwner(layer, fid);
            if (owner && Number(owner.user_id) === req.auth.uid) return res.status(400).json({ success: false, error: 'لا يمكنك تقييم إعلانك الخاص.' });
            await servicesPool.query(
                `INSERT INTO public.listing_ratings (layer, feature_id, user_id, rating, comment)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (layer, feature_id, user_id)
                 DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, updated_at = NOW()`,
                [layer, fid, req.auth.uid, rating, comment]
            );
            if (owner) {
                await servicesPool.query(
                    `INSERT INTO public.notifications (user_id, title, message, type, is_read, created_at)
                     VALUES ($1, $2, $3, 'info', false, NOW())`,
                    [owner.user_id, '⭐ تقييم جديد', `حصل إعلانك (${LAYER_AR_NAMES[layer] || layer}) على تقييم ${rating} من 5.`]
                ).catch(() => {});
            }
            res.json({ success: true });
        } catch (err) {
            console.error('❌ خطأ أثناء حفظ التقييم:', err.message);
            res.status(500).json({ success: false, error: 'فشل حفظ التقييم', details: errDetails(err) });
        }
    });

    app.delete('/api/listing-ratings', requireAuth, async (req, res) => {
        const layer = parseLayerParam(req.query.layer);
        const fid = parseId(req.query.feature_id);
        if (!layer || !fid) return res.status(400).json({ success: false, error: 'الإعلان غير صالح.' });
        await servicesPool.query('DELETE FROM public.listing_ratings WHERE layer = $1 AND feature_id = $2 AND user_id = $3', [layer, fid, req.auth.uid]);
        res.json({ success: true });
    });

    // ملخص تقييمات عدة معالم دفعة واحدة (لبطاقات نتائج البحث)
    app.post('/api/listing-ratings/summary', async (req, res) => {
        const items = Array.isArray(req.body && req.body.items) ? req.body.items.slice(0, 200) : [];
        const pairs = items.map(i => ({ layer: parseLayerParam(i.layer), fid: parseId(i.feature_id) })).filter(p => p.layer && p.fid && !layerVisibility.isHidden(p.layer));
        if (!pairs.length) return res.json({ success: true, summary: {} });
        try {
            const layers = pairs.map(p => p.layer);
            const fids = pairs.map(p => p.fid);
            const r = await servicesPool.query(`
                WITH wanted AS (SELECT * FROM unnest($1::text[], $2::int[]) AS w(layer, feature_id)),
                ratings AS (
                    SELECT lr.layer, lr.feature_id, lr.rating FROM public.listing_ratings lr JOIN wanted w USING (layer, feature_id)
                    UNION ALL
                    SELECT sr.service_layer, sr.feature_id, sr.rating FROM public.service_ratings sr
                    JOIN wanted w ON w.layer = sr.service_layer AND w.feature_id = sr.feature_id
                )
                SELECT layer, feature_id, ROUND(AVG(rating)::numeric, 1) AS avg, COUNT(*)::int AS total
                FROM ratings GROUP BY layer, feature_id`, [layers, fids]);
            const summary = {};
            r.rows.forEach(row => { summary[`${row.layer}:${row.feature_id}`] = { average: Number(row.avg), total: row.total }; });
            res.json({ success: true, summary });
        } catch (err) {
            res.status(500).json({ success: false, error: 'فشل جلب الملخص', details: errDetails(err) });
        }
    });

    // -----------------------------------------------------------------------
    // مساعدات مُصدَّرة لباقي السيرفر
    // -----------------------------------------------------------------------
    function normalizeWhatsapp(raw) {
        let digits = String(raw || '').replace(/\D/g, '');
        if (!digits) return null;
        if (digits.startsWith('00')) digits = digits.slice(2);
        if (digits.startsWith('0') && digits.length === 10) digits = '970' + digits.slice(1);
        else if (digits.length === 9 && digits.startsWith('5')) digits = '970' + digits;
        return digits;
    }

    /** مزود الخدمة المسؤول عن معلم (للطلبات والدردشة) - يدعم الإعلانات المتعددة */
    async function findProviderForFeature(layer, featureId) {
        const canon = canonicalLayer(layer) || layer;
        const owner = await findOwner(canon, Number(featureId));
        if (owner && owner.role === 'provider' && owner.is_active !== false) {
            const u = await servicesPool.query('SELECT user_id, full_name, phone FROM public.users WHERE user_id = $1', [owner.user_id]);
            return u.rows[0] || null;
        }
        return null;
    }

    async function linkedFeaturesMap() {
        const r = await servicesPool.query(
            `SELECT pl.layer, pl.feature_id FROM public.provider_listings pl
             JOIN public.users u ON u.user_id = pl.user_id
             WHERE u.role = 'provider' AND u.is_active = true`
        );
        const linked = {};
        r.rows.forEach(row => {
            if (layerVisibility.isHidden(row.layer)) return;
            (linked[row.layer] = linked[row.layer] || []).push(row.feature_id);
        });
        return linked;
    }

    /** بعد تعديل المشرف لربط مزود (users.service_layer/feature_id) نحدّث سطر الربط الأساسي */
    async function syncLegacyLink(userId) {
        const r = await servicesPool.query('SELECT role, service_layer, feature_id FROM public.users WHERE user_id = $1', [userId]);
        const u = r.rows[0];
        await servicesPool.query(`DELETE FROM public.provider_listings WHERE user_id = $1 AND source = 'legacy'`, [userId]);
        const layer = u && canonicalLayer(u.service_layer);
        if (!u || u.role !== 'provider' || !layer || !u.feature_id) return;
        // المعلم صار لهذا المزود: ننقل ملكيته إليه (حتى لو كان مسجلاً لمزود آخر)
        await servicesPool.query(
            `INSERT INTO public.provider_listings (user_id, layer, feature_id, source) VALUES ($1, $2, $3, 'legacy')
             ON CONFLICT (layer, feature_id) DO UPDATE SET user_id = EXCLUDED.user_id, source = 'legacy'`,
            [userId, layer, u.feature_id]
        );
    }

    return { optionalAuth, resolveOptionalAuth, findProviderForFeature, linkedFeaturesMap, canonicalLayer, serviceCatalog, propertyCatalog, syncLegacyLink };
}
