// Last in line: health check, unknown /api → 404, the React app (web/dist), the error handler.
import express from 'express';
import fs from 'fs';
import path from 'path';
import { IS_PROD, ROOT_DIR, app } from './app.js';
import { servicesPool } from './database.js';

// ❤️ فحص الصحة (لأنظمة المراقبة): يتأكد من الاتصال بقاعدة البيانات
app.get('/healthz', async (req, res) => {
    try {
        await servicesPool.query('SELECT 1');
        res.json({ ok: true, uptime: Math.round(process.uptime()) });
    } catch (e) {
        res.status(503).json({ ok: false });
    }
});

// 8. مسار معالجة غير المطابق
app.use('/api', (req, res) => {
    res.status(404).json({ error: 'API endpoint not found', path: req.path });
});

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
