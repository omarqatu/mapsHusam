// Last in line: health check, unknown /api → 404, the React app (web/dist), the error handler.
import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import { IS_PROD, ROOT_DIR, app } from './app.js';
import { servicesPool, realestatePool } from './database.js';
import { LAYER_AR_NAMES, SERVICE_TYPE_KEYS } from './layers.js';
import { viewerRules } from './visibility.js';
import { isLayerHidden, publicListingSql } from '../lib/listing-rules.js';
import { listingId, listingSource, ogImage, ogText, withListingMeta } from '../lib/listing-og.js';

// ❤️ فحص الصحة (لأنظمة المراقبة): يتأكد من الاتصال بقاعدة البيانات
app.get('/healthz', async (req, res) => {
    try {
        await Promise.all([servicesPool.query('SELECT 1'), realestatePool.query('SELECT 1')]);
        res.json({ ok: true, uptime: Math.round(process.uptime()) });
    } catch (e) {
        res.status(503).json({ ok: false });
    }
});

// Deployment readiness: connectivity alone cannot reveal a failed CREATE/ALTER or an unwritable upload folder.
app.get('/readyz', async (req, res) => {
    const uploadRoot = process.env.UPLOADS_DIR || path.join(ROOT_DIR, 'uploads');
    const photoDir = path.join(uploadRoot, 'listing-photos');
    const videoDir = path.join(uploadRoot, 'listing-videos');
    const photoProbe = path.join(photoDir, `.readiness-${crypto.randomUUID()}`);
    const videoProbe = path.join(videoDir, `.readiness-${crypto.randomUUID()}`);
    try {
        await Promise.all([
            servicesPool.query(`SELECT force_logout_flag, token_version, whatsapp_number FROM public.users LIMIT 0;
                SELECT price, area, currency FROM public.service_all LIMIT 0;
                SELECT appointment_at FROM public.service_requests LIMIT 0;
                SELECT id FROM public.service_ratings LIMIT 0;
                SELECT layer, feature_id, user_id FROM public.listing_owners LIMIT 0;
                SELECT id, type FROM public.listing_photos LIMIT 0;
                SELECT id, layer, feature_id, user_id, type FROM public.listing_videos LIMIT 0;
                SELECT video, media_default FROM public.service_all LIMIT 0;
                SELECT area, currency FROM public.listing_submissions LIMIT 0;
                SELECT content_key FROM public.platform_content LIMIT 0;`),
            realestatePool.query(`SELECT video, media_default FROM public."ApartRent" LIMIT 0;
                SELECT video, media_default FROM public."ApartSale" LIMIT 0;
                SELECT video, media_default FROM public."LandSale" LIMIT 0;`),
        ]);
        await Promise.all([
            fs.promises.writeFile(photoProbe, '', { flag: 'wx' }),
            fs.promises.writeFile(videoProbe, '', { flag: 'wx' }),
        ]);
        await Promise.all([fs.promises.unlink(photoProbe), fs.promises.unlink(videoProbe)]);
        res.json({ ok: true });
    } catch (error) {
        await Promise.all([photoProbe, videoProbe].map((probe) => fs.promises.unlink(probe).catch(() => {})));
        res.status(503).json({ ok: false });
    }
});

// 8. مسار معالجة غير المطابق
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

// Existing database photo URLs may still point at /pic. Keep those images available across the first migration.
// Serve image extensions only; never expose source, env, HTML or other files in this old directory.
app.use('/pic', (req, res, next) => {
    if (!/\.(?:jpe?g|png|gif|webp|avif|ico)$/i.test(req.path)) return res.sendStatus(404);
    next();
}, express.static(path.join(ROOT_DIR, 'pic'), { dotfiles: 'ignore', index: false, redirect: false, fallthrough: false }));

// 9أ. تطبيق React (web/dist)
// يُقدَّم التطبيق من web/dist (ملفات مبنية + مسارات SPA + تحويل روابط الصفحات القديمة). SERVE_REACT_APP=off يوقف تقديمه.
const REACT_DIST = path.join(ROOT_DIR, 'web', 'dist');
const SERVE_REACT = (process.env.SERVE_REACT_APP || 'auto').toLowerCase() !== 'off'
    && fs.existsSync(path.join(REACT_DIST, 'index.html'));
console.log(SERVE_REACT ? `🆕 يُقدَّم تطبيق React من ${REACT_DIST}` : '⚠️ web/dist غير موجود (أو SERVE_REACT_APP=off): لا توجد واجهة تُقدَّم، شغّل npm run build داخل web');

if (SERVE_REACT) {
    // الصفحات القديمة → مساراتها الجديدة (مع الاستعلام: ?group=fuel ما زال يعمل بصفحة البحث)
    const LEGACY_PAGE_TO_ROUTE = {
        '/index.html': '/',
        '/dashboard': '/admin/dashboard',
        '/no-map-search.html': '/search',
        '/widgets-portal.html': '/widgets/portal',
        '/widgets-ticker.html': '/widgets/ticker',
        '/notifications-panel.html': '/notifications',
        '/admin-users.html': '/admin/users',
        '/admin-view-user.html': '/admin/users', // كانت تعتمد رمزاً في الرابط؛ الصفحة الجديدة تفتح جلستها بنفسها
        '/dashboard.html': '/admin/dashboard',
        '/widgets-admin.html': '/admin/widgets'
    };
    app.get(Object.keys(LEGACY_PAGE_TO_ROUTE), (req, res) => {
        const query = req.originalUrl.includes('?') && req.path !== '/admin-view-user.html'
            ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
        res.redirect(301, LEGACY_PAGE_TO_ROUTE[req.path] + query);
    });

    // ملفات مبنية بأسماء تحمل بصمة المحتوى: تُخزَّن سنة. باقي الملفات (أيقونات، أصوات) ساعة.
    app.use('/assets', express.static(path.join(REACT_DIST, 'assets'), { immutable: true, maxAge: '1y', index: false, fallthrough: false }));
    app.use(express.static(REACT_DIST, { index: false, maxAge: '1h', redirect: false, dotfiles: 'ignore' }));

    // صفحة الإعلان المشترَك (/l/<type>/<id>): نفس index.html مع عنوان الإعلان ووصفه وصورته، لتظهر معاينة الرابط
    // في واتساب وفيسبوك. نفس قواعد البحث العام لزائر بلا حساب (الطبقات المخفية، المسحوب والمنتهي)، وبلا أي رقم تواصل.
    const INDEX_HTML = path.join(REACT_DIST, 'index.html');
    let indexCache = { mtimeMs: 0, html: '' };
    const indexHtml = async () => {
        const { mtimeMs } = await fs.promises.stat(INDEX_HTML);
        if (mtimeMs !== indexCache.mtimeMs) indexCache = { mtimeMs, html: await fs.promises.readFile(INDEX_HTML, 'utf8') };
        return indexCache.html;
    };
    app.get('/l/:key/:id', async (req, res, next) => {
        try {
            const source = listingSource(req.params.key, SERVICE_TYPE_KEYS);
            const id = listingId(req.params.id);
            const html = await indexHtml();
            res.set('Cache-Control', 'no-cache');
            if (!source || id === null || isLayerHidden(req.params.key, (await viewerRules(null)).hidden)) return res.type('html').send(html);
            const pool = source.isProperty ? realestatePool : servicesPool;
            const { rows } = source.isProperty
                ? await pool.query(`SELECT * FROM public."${source.table}" WHERE fid = $1 AND ${publicListingSql(true)}`, [id])
                : await pool.query(`SELECT * FROM public.service_all WHERE id = $1 AND discriminator = $2 AND ${publicListingSql(false)}`, [id, source.discriminator]);
            if (!rows[0]) return res.type('html').send(html);
            const origin = `${req.protocol}://${req.get('host')}`;
            const { title, description } = ogText(rows[0], LAYER_AR_NAMES[req.params.key] || 'خدمة');
            res.type('html').send(withListingMeta(html, {
                title,
                description,
                url: `${origin}/l/${req.params.key}/${id}`,
                image: ogImage(rows[0].pic, origin),
                siteName: 'نطاق',
            }));
        } catch (error) {
            // تعذّرت القراءة: الصفحة نفسها بلا معاينة، والتطبيق يقرأ الإعلان بنفسه
            console.error('Listing preview error:', error.message);
            indexHtml().then((html) => res.type('html').send(html), next);
        }
    });

    // مسارات التطبيق (بلا امتداد ملف) → index.html دون تخزين مؤقت حتى يلتقط كل نشر جديد فوراً
    app.get(/^\/(?!api(?:\/|$)|geoserver-proxy(?:\/|$)|socket\.io(?:\/|$))[^.]*$/, (req, res) => {
        res.set('Cache-Control', 'no-cache');
        res.sendFile(path.join(REACT_DIST, 'index.html'));
    });
}

// 9ب. بدون بناء التطبيق (web/dist غير موجود) لا يوجد ما يُقدَّم: رسالة واضحة بدل صفحة فارغة.
// (تُقدَّم الآن ملفات web/dist وحدها؛ لم يعد جذر المشروع يُقدَّم كملفات ثابتة، فلا تُكشف README.md وغيرها.)
if (!SERVE_REACT) {
    app.get(/^\/(?!api(?:\/|$)|geoserver-proxy(?:\/|$)|socket\.io(?:\/|$))/, (req, res) => {
        res.status(503).type('text/plain; charset=utf-8').send('الموقع قيد التحديث: لم يُبنَ التطبيق بعد (شغّل npm run build داخل مجلد web ثم أعد تشغيل الخدمة).');
    });
}

// 10. خطأ عام للميدل وير
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (res.headersSent) {
        return next(err);
    }
    const errStatus = err.status || 500;
    res.status(errStatus).json({ error: (IS_PROD && errStatus >= 500) ? 'Unhandled server error' : (err.message || 'Unhandled server error') });
});
