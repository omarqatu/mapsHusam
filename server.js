// Entry point. Each module registers its part at import, in this order (it is the order of the former single file).
import { PORT, io, server } from './server/app.js';
import { GEOSERVER_TARGET, PG_HOST, REAL_ESTATE_DB_NAME, SERVICES_DB_NAME, realestatePool, servicesPool } from './server/database.js';
import './server/layers.js';
import './server/auth.js';
import './server/state.js';
import './server/listings.js';
import './server/routes/public-info.js';
import './server/routes/provider.js';
import './server/routes/geoserver-proxy.js';
import './server/routes/events.js';
import './server/routes/auth.js';
import './server/routes/search.js';
import './server/routes/platform-content.js';
import './server/routes/admin-view.js';
import './server/routes/widgets.js';
import './server/routes/admin-users.js';
import './server/routes/requests.js';
import './server/routes/listing-submissions.js';
import './server/routes/provider-links.js';
import './server/frontend.js';
import './server/sockets.js';

// تصدير io لاستخدامه في أماكن أخرى إذا لزم الأمر
global.io = io;

// بدء السيرفر مع دعم Socket.io
server.listen(PORT, () => {
    console.log('==============================================');
    console.log(`🚀 السيرفر يعمل الآن على: http://0.0.0.0:${PORT}`);
    console.log(`📊 لوحة التحكم: http://0.0.0.0:${PORT}/dashboard.html`);
    console.log(`📊 نظام تحديث الـ PostGIS والـ WFS-T متكامل ومؤمن بالكامل بالقيم الجغرافية الحقيقية`);
    console.log(`📡 قاعدة البيانات: host=${PG_HOST}, services=${SERVICES_DB_NAME}, realestate=${REAL_ESTATE_DB_NAME}`);
    console.log(`📡 GeoServer target: ${GEOSERVER_TARGET}`);
    console.log(`🔌 Socket.io مفعل وجاهز للإشعارات`);
    console.log('==============================================');
});

// 🆕 [شبكة أمان أخيرة]: تسجيل أي خطأ غير مُعالَج بدل انهيار العملية بالكامل.
// هذا لا يخفي الأخطاء - يطبعها بالكونسول بوضوح - لكنه يمنع توقف كامل السيرفر
// بسبب استثناء واحد لم نتوقعه بجزء بعيد من الكود.
process.on('unhandledRejection', (reason) => {
    console.error('🚨 [Unhandled Rejection] لم تتم معالجة هذا الخطأ:', reason);
});
process.on('uncaughtException', (err) => {
    console.error('🚨 [Uncaught Exception] خطأ غير متوقع بالكود:', err);
});

// 🔒 إغلاق نظيف عند إيقاف/إعادة تشغيل السيرفر (بدل قطع الطلبات الجارية فجأة)
let shuttingDown = false;
async function gracefulShutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 استلام ${signal}: إغلاق نظيف...`);
    setTimeout(() => process.exit(1), 10000).unref(); // مهلة قصوى 10 ثوانٍ
    try {
        io.close(); // يغلق اتصالات Socket ويوقف استقبال طلبات HTTP جديدة
        await Promise.allSettled([servicesPool.end(), realestatePool.end()]);
    } finally {
        process.exit(0);
    }
}
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
