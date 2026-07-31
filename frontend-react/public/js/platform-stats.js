/**
 * js/platform-stats.js
 * ------------------------------------------------------------------
 * ملف موحّد لجلب إحصائيات المنصة (عدد المستخدمين + التصنيف، عدد المشاهدات،
 * عدد الخدمات/الطبقات، عدد المعالم/مزودي الخدمات) وعرضها في أي عدد من
 * الحاويات بالصفحة دفعة واحدة.
 *
 * طريقة الاستخدام: ضع أي عنصر (div) بالصفحة يحمل الخاصية data-platform-stats-target
 * وسيتم تعبئته تلقائياً بمجرد تحميل الصفحة. مثال:
 *   <div class="pstats-wrap pstats-inline" data-platform-stats-target></div>
 *
 * نقطة النهاية المتوقعة من السيرفر:
 *   GET /api/platform-stats
 *   { success: true, data: { usersTotal, usersAdmin, usersUser, usersProvider,
 *                             viewsTotal, servicesCount, featuresCount } }
 *
 * إذا تعذر الوصول للسيرفر أو لم تكن نقطة النهاية جاهزة بعد، تُعرض رسالة
 * "تعذر تحميل الإحصائيات" بدلاً من كسر الصفحة.
 * ------------------------------------------------------------------
 */
(function () {
    'use strict';

    let cachedStats = null;
    let fetchPromise = null;

    async function fetchStats(forceRefresh) {
        if (!forceRefresh && cachedStats) return cachedStats;
        if (!forceRefresh && fetchPromise) return fetchPromise;

        fetchPromise = (async () => {
            try {
                const res = await fetch(window.location.origin + '/api/platform-stats');
                const json = await res.json();
                if (json && json.success && json.data) {
                    cachedStats = json.data;
                    return cachedStats;
                }
                return null;
            } catch (err) {
                console.warn('تعذر جلب إحصائيات المنصة:', err.message);
                return null;
            } finally {
                fetchPromise = null;
            }
        })();

        return fetchPromise;
    }

    function formatNum(n) {
        n = Number(n) || 0;
        return n.toLocaleString();
    }

    function buildStatsHTML(stats) {
        const usersTotal = stats.usersTotal ?? 0;
        const usersAdmin = stats.usersAdmin ?? 0;
        const usersUser = stats.usersUser ?? 0;
        const usersProvider = stats.usersProvider ?? 0;
        const views = stats.viewsTotal ?? 0;
        const services = stats.servicesCount ?? 0;
        const features = stats.featuresCount ?? 0;

        return `
            <div class="pstats-card" data-stat="users">
                <div class="pstats-icon"><i class="fas fa-users"></i></div>
                <div class="pstats-info">
                    <div class="pstats-value">${formatNum(usersTotal)}</div>
                    <div class="pstats-label">عدد المستخدمين</div>
                    <div class="pstats-breakdown">
                        <span><i class="fas fa-user-shield"></i> ${formatNum(usersAdmin)} مشرف</span>
                        <span><i class="fas fa-user"></i> ${formatNum(usersUser)} مستخدم</span>
                        <span><i class="fas fa-briefcase"></i> ${formatNum(usersProvider)} مزود</span>
                    </div>
                </div>
            </div>
            <div class="pstats-card" data-stat="views">
                <div class="pstats-icon"><i class="fas fa-eye"></i></div>
                <div class="pstats-info">
                    <div class="pstats-value">${formatNum(views)}</div>
                    <div class="pstats-label">عدد المشاهدات</div>
                </div>
            </div>
            <div class="pstats-card" data-stat="services">
                <div class="pstats-icon"><i class="fas fa-layer-group"></i></div>
                <div class="pstats-info">
                    <div class="pstats-value">${formatNum(services)}</div>
                    <div class="pstats-label">عدد الخدمات</div>
                </div>
            </div>
            <div class="pstats-card" data-stat="features">
                <div class="pstats-icon"><i class="fas fa-map-marker-alt"></i></div>
                <div class="pstats-info">
                    <div class="pstats-value">${formatNum(features)}</div>
                    <div class="pstats-label">عدد مزودي الخدمات</div>
                </div>
            </div>
        `;
    }

    function renderInto(container, stats) {
        if (!container) return;
        if (!stats) {
            container.innerHTML = '<div class="pstats-error"><i class="fas fa-triangle-exclamation"></i> تعذر تحميل الإحصائيات حالياً</div>';
            return;
        }
        container.innerHTML = buildStatsHTML(stats);
    }

    async function initAll(forceRefresh) {
        const targets = document.querySelectorAll('[data-platform-stats-target]');
        if (!targets.length) return;

        targets.forEach(t => {
            if (!t.dataset.pstatsFilled) {
                t.innerHTML = '<div class="pstats-loading"><i class="fas fa-spinner fa-spin"></i> جاري تحميل الإحصائيات...</div>';
            }
        });

        const stats = await fetchStats(forceRefresh);
        targets.forEach(t => {
            renderInto(t, stats);
            t.dataset.pstatsFilled = '1';
        });
    }

    if (document.readyState !== 'loading') {
        initAll();
    } else {
        document.addEventListener('DOMContentLoaded', function () { initAll(); });
    }

    // إتاحتها عالمياً لإعادة الجلب يدوياً، أو لتعبئة حاويات أُنشئت ديناميكياً
    // لاحقاً (مثل تبويب "الرئيسية" بنظام mobile-tabs.js)
    window.refreshPlatformStats = initAll;
})();