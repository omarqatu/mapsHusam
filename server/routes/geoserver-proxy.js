// /geoserver-proxy: whitelisted reads for everyone, WFS-T writes for admins only.
import { createProxyMiddleware } from 'http-proxy-middleware';
import path from 'path';
import { app, debugLog } from '../app.js';
import { GEOSERVER_TARGET } from '../database.js';
import { isValidLayer } from '../layers.js';
import { activeAdminUidFromToken } from '../auth.js';
import { PROPERTY_TABLES, localIsoDate, publicProxyQuery } from '../../lib/listing-rules.js';
import { getHiddenLayers } from '../visibility.js';
import { SERVICE_TYPE_KEYS } from '../layers.js';

// 3. إعداد البروكسي لـ GeoServer
// [إجراء أمني 2]: تشفير وحماية البروكسي لمنع الحذف العشوائي (WFS-T protection)
// 🆕 [تشديد أمني]: استخراج كل typeName/layer مذكور بالطلب (سواء GET query
// params أو XML الخاص بـ WFS-T POST) والتحقق من أنه ضمن القائمة البيضاء
// المعتمدة فعلياً بالتطبيق (ALLOWED_LAYERS) قبل السماح له بالوصول لـ GeoServer
// أسماء الباراميترات التي تحمل اسم طبقة (بحروف صغيرة: GeoServer لا يفرّق بين الحروف الكبيرة والصغيرة بمفاتيح الاستعلام)
const PROXY_LAYER_PARAMS = new Set(['typename', 'typenames', 'layers', 'layer', 'query_layers', 'featureid']);

function extractRequestedLayerNames(req) {
    const names = new Set();

    for (const [key, value] of Object.entries(req.query || {})) {
        if (!PROXY_LAYER_PARAMS.has(key.toLowerCase())) continue;
        const parts = Array.isArray(value) ? value : [value];
        parts.forEach(part => String(part).split(',').forEach(tn => {
            const name = tn.trim();
            // featureID=<layer>.<id> : اسم الطبقة هو ما قبل النقطة
            names.add(key.toLowerCase() === 'featureid' ? name.split('.')[0] : name);
        }));
    }

    if (typeof req.body === 'string' && req.body.length > 0) {
        const attrMatches = req.body.match(/typeName="([^"]+)"/g) || [];
        attrMatches.forEach(m => {
            const val = m.match(/typeName="([^"]+)"/)[1];
            names.add(val.trim());
        });
        const elMatches = req.body.match(/<(?:\w+:)?TypeName>([^<]+)<\/(?:\w+:)?TypeName>/g) || [];
        elMatches.forEach(m => {
            const val = m.replace(/<[^>]+>/g, '').trim();
            names.add(val);
        });
    }

    return Array.from(names);
}

// طبقات مسموحة عبر البروكسي فقط (ليست جزءاً من قائمة API): الصورة الجوية
const PROXY_EXTRA_LAYERS = ['WB_2023_10_18mbt'];

// 🔒 واجهات إدارة GeoServer التي لا يجب الوصول لها عبر البروكسي (REST / الواجهة الإدارية / WPS / الدخول)
const GEOSERVER_BLOCKED_PATHS = /(^|\/)(rest|web|wps|monitor|j_spring_security_check|j_spring_security_logout|logout)(\/|$)/i;

// 🔒 الكتابة عبر البروكسي (WFS-T) للمشرف فقط، كما في الواجهة القديمة (canEdit للأدمن وحده).
// هيدر Authorization يحمل دخول GeoServer (Basic)، لذلك يصل توكن التطبيق بهيدر X-App-Token ويُحذف قبل التمرير.
const PROXY_READ_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// طبقات الإعلانات (خدمات وعقارات): الزائر لا يقرؤها إلا عبر WFS GetFeature بفلتر يفرضه السيرفر (lib/listing-rules.js)،
// فلا يصل المسحوب أو المنتهي أو طبقة أخفاها المشرف حتى لمن يطلب GeoServer مباشرة. المشرف يرى كل شيء (X-App-Token).
const LISTING_LAYERS = new Set(['service_all', ...PROPERTY_TABLES, ...SERVICE_TYPE_KEYS]);
// أشكال المسارات التي تطلبها الواجهة: /ows و /wfs و /wms، أو مسبوقة بمساحة العمل
const PUBLIC_PROXY_PATH = /^\/(?:[A-Za-z0-9_]+\/)?(?:ows|wfs|wms)$/i;
const PUBLIC_WFS_REQUESTS = new Set(['getcapabilities', 'describefeaturetype']);

function rewriteQueryString(req, query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) params.append(k, String(v));
    const qs = params.toString();
    const base = req.url.split('?')[0];
    req.url = qs ? `${base}?${qs}` : base;
    req.originalUrl = qs ? `${req.originalUrl.split('?')[0]}?${qs}` : req.originalUrl.split('?')[0];
}

app.use('/geoserver-proxy', async (req, res, next) => {
    const isAdmin = !!(await activeAdminUidFromToken(req.headers['x-app-token']));
    if (!PROXY_READ_METHODS.includes(req.method) && !isAdmin) {
        console.warn(`🚫 [Proxy Guard] رُفض طلب ${req.method} بلا توكن مشرف من IP: ${req.ip}`);
        return res.status(403).json({ error: 'التعديل على الخريطة للمشرف فقط.' });
    }
    let proxiedPath = req.path;
    try { proxiedPath = decodeURIComponent(req.path); } catch (e) { return res.status(400).end(); }
    proxiedPath = path.posix.normalize(proxiedPath);
    if (GEOSERVER_BLOCKED_PATHS.test(proxiedPath) || String(req.query.service || '').toLowerCase() === 'wps') {
        console.warn(`🚫 [Proxy Guard] رُفض مسار إداري: ${proxiedPath} من IP: ${req.ip}`);
        return res.status(403).json({ error: 'الوصول لهذا المسار غير مسموح به.' });
    }
    // SLD خارجي/مضمّن قد يجعل GeoServer يقرأ طبقة غير مسموحة أو يجلب رابطاً خارجياً
    if (Object.keys(req.query || {}).some(k => /^sld/i.test(k))) {
        return res.status(403).json({ error: 'هذا الطلب غير مسموح به.' });
    }
    const requestedLayers = extractRequestedLayerNames(req);
    for (const rawName of requestedLayers) {
        const layerOnly = rawName.includes(':') ? rawName.split(':').pop() : rawName;
        if (!isValidLayer(layerOnly) && !PROXY_EXTRA_LAYERS.includes(layerOnly)) {
            console.warn(`🚫 [Proxy Guard] رُفض طلب لطبقة غير مصرح بها: ${rawName} من IP: ${req.ip}`);
            return res.status(403).json({ error: 'الوصول لهذه الطبقة غير مسموح به.' });
        }
    }
    if (!isAdmin) {
        const listingLayers = requestedLayers.map(n => (n.includes(':') ? n.split(':').pop() : n)).filter(n => LISTING_LAYERS.has(n));
        if (listingLayers.length) {
            const query = req.query || {};
            const get = (name) => Object.entries(query).find(([k]) => k.toLowerCase() === name)?.[1];
            const service = String(get('service') || '').toLowerCase();
            const request = String(get('request') || '').toLowerCase();
            const isWfs = service === 'wfs' || /\/wfs$/i.test(proxiedPath);
            if (requestedLayers.length !== 1 || !PUBLIC_PROXY_PATH.test(proxiedPath) || !isWfs ||
                Object.values(query).some(v => typeof v !== 'string')) {
                return res.status(403).json({ error: 'هذا الطلب غير مسموح به.' });
            }
            if (request !== 'getfeature') {
                if (!PUBLIC_WFS_REQUESTS.has(request)) return res.status(403).json({ error: 'هذا الطلب غير مسموح به.' });
            } else {
                const r = publicProxyQuery(query, listingLayers[0], { hidden: await getHiddenLayers(), today: localIsoDate() });
                if (r.error) {
                    // طبقة مخفية = لا معالم (وليس خطأ يعيد المتصفح المحاولة عليه)
                    if (r.status === 404) return res.json({ type: 'FeatureCollection', features: [], totalFeatures: 0 });
                    return res.status(r.status).json({ error: 'هذا الطلب غير مسموح به.' });
                }
                rewriteQueryString(req, r.query);
            }
        }
    }
    // جواب طبقة إعلانات يختلف حسب من يطلبه (المشرف يرى المسحوب): لا يُخزَّن في المتصفح أو أي وسيط
    if (requestedLayers.some(n => LISTING_LAYERS.has(n.includes(':') ? n.split(':').pop() : n))) req.listingRead = true;
    next();
}, (req, res, next) => {
    debugLog(`[Proxy] Request to: ${req.url} from IP: ${req.ip}`);
    debugLog(`[Proxy] GeoServer Target: ${GEOSERVER_TARGET}`);
    next();
}, createProxyMiddleware({
    target: GEOSERVER_TARGET,
    changeOrigin: true,
    pathRewrite: { '^/geoserver-proxy': '' },
    secure: false, // للتعامل مع شهادات SSL غير الموثوقة
    timeout: 60000,
    proxyTimeout: 60000,
    logLevel: 'warn',
    onProxyReq: (proxyReq, req, res) => {
        proxyReq.removeHeader('x-app-token'); // توكن التطبيق لا يصل إلى GeoServer
        debugLog(`[Proxy] Forwarding to: ${GEOSERVER_TARGET}${req.url}`);
        debugLog(`[Proxy] Content-Type: ${req.headers['content-type']}`);
        // 🔒 كان Buffer.byteLength(req.body) يرمي خطأ عند كل طلب GET (لأن req.body يكون {} وليس نصاً)
        debugLog(`[Proxy] Body length: ${typeof req.body === 'string' ? Buffer.byteLength(req.body) : 0}`);

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
    onProxyRes: (proxyRes, req) => {
        if (req.listingRead) proxyRes.headers['cache-control'] = 'private, no-store';
    },
    onError: (err, req, res) => {
        console.error('[Proxy] Error:', err.message, '| url:', req.url);
        if (!res.headersSent) {
            // 🔒 لا نكشف عنوان GeoServer الداخلي للعميل
            res.status(502).json({ error: 'GeoServer connection failed' });
        }
    }
}));
