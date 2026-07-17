/**
 * viewport-guard.js
 * ------------------------------------------------------------------
 * يضمن أن أي لوحة قابلة للسحب أو التحجيم (نتائج البحث، الطبقات، القياس،
 * مشاركة الموقع، تحرير نقاط/مضلعات/خطوط، لوحة مزود الخدمة، بانر التواصل...)
 * تبقى دائماً بالكامل داخل حدود الشاشة المرئية - حتى بعد:
 *   - تدوير الجهاز (Portrait ↔ Landscape)
 *   - تصغير/تكبير نافذة المتصفح على الكمبيوتر
 *   - سحب اللوحة يدوياً قرب أي حافة
 *   - تكبير اللوحة يدوياً من زاويتها (خاصية resize في CSS)
 *
 * الفكرة: دالة واحدة عامة window.clampElementToViewport(el) تُستدعى تلقائياً
 * من هذا الملف (عند فتح لوحة/تغيير حجم الشاشة)، ومن ملفات أخرى (provider-panel.js
 * أثناء السحب المباشر، resizable-panels.js بعد التحجيم اليدوي).
 *
 * لا تعتمد أي لوحة حالياً على هذا الملف لتعمل بشكل طبيعي؛ هو فقط "شبكة أمان"
 * تصحح الموضع إذا خرجت اللوحة عن الحدود، ولا تفعل أي شيء إن كانت أصلاً سليمة.
 */
(function () {
    'use strict';

    const MARGIN = 8; // أقل مسافة مسموحة بين اللوحة وأقرب حافة للشاشة

    /**
     * يعيد أي عنصر positioned (fixed/absolute) داخل حدود الشاشة إن كان خارجها
     * جزئياً أو كلياً، دون أي تأثير إطلاقاً إن كان أصلاً داخل الحدود بالكامل.
     */
    function clampElementToViewport(el, margin) {
        if (!el) return;

        const m = typeof margin === 'number' ? margin : MARGIN;
        const rect = el.getBoundingClientRect();

        // عنصر مخفي (display:none) أو بلا أبعاد بعد - لا داعي لأي حساب
        if (rect.width === 0 && rect.height === 0) return;

        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = rect.left;
        let top = rect.top;
        let needsFix = false;

        if (rect.right > vw - m) { left = vw - m - rect.width; needsFix = true; }
        if (rect.bottom > vh - m) { top = vh - m - rect.height; needsFix = true; }
        // نعيد فحص الحافة اليسرى/العلوية بعد أي تصحيح أعلاه لضمان عدم تجاوزهما بالمقابل
        if (left < m) { left = m; needsFix = true; }
        if (top < m) { top = m; needsFix = true; }

        // حالة نادرة: اللوحة نفسها أعرض/أطول من الشاشة بالكامل - نثبّتها من الزاوية
        if (rect.width > vw - m * 2) left = m;
        if (rect.height > vh - m * 2) top = m;

        if (!needsFix) return;

        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('left', Math.round(left) + 'px', 'important');
        el.style.setProperty('top', Math.round(top) + 'px', 'important');
        el.style.setProperty('right', 'auto', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
    }

    // إتاحتها عالمياً لاستخدامها من provider-panel.js و resizable-panels.js وغيرها
    window.clampElementToViewport = clampElementToViewport;

    // ==========================================================================
    // العناصر التي نراقبها باستمرار (فقط الظاهرة حالياً على الشاشة)
    // ==========================================================================
    function getGuardedElements() {
        const list = [];

        document.querySelectorAll('.panel-right').forEach(function (p) {
            if (!p.classList.contains('hidden')) list.push(p);
        });

        const provider = document.getElementById('provider-mini-panel');
        if (provider && !provider.classList.contains('hidden') && provider.style.display !== 'none') {
            list.push(provider);
        }

        const banner = document.querySelector('.feedback-banner-wrapper');
        if (banner) list.push(banner);

        return list;
    }

    function clampAllVisible() {
        getGuardedElements().forEach(function (el) { clampElementToViewport(el); });
    }

    // --------------------------------------------------------------------
    // 1) إعادة الفحص عند تغيير حجم النافذة أو تدوير الجهاز
    //    (مع تأخير بسيط لتفادي الحسابات المتكررة أثناء السحب المستمر للحجم)
    // --------------------------------------------------------------------
    let resizeToken = null;
    function scheduleClamp() {
        clearTimeout(resizeToken);
        resizeToken = setTimeout(clampAllVisible, 150);
    }
    window.addEventListener('resize', scheduleClamp);
    window.addEventListener('orientationchange', scheduleClamp);

    // --------------------------------------------------------------------
    // 2) مراقبة فتح أي لوحة (إزالة كلاس hidden) لضبط موضعها فوراً بعد ظهورها،
    //    خصوصاً لو كانت محفوظة بموضع سابق من شاشة مختلفة الحجم.
    // --------------------------------------------------------------------
    const bodyObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.type !== 'attributes' || m.attributeName !== 'class') return;
            const el = m.target;
            if (!el.classList) return;
            const isTracked = el.classList.contains('panel-right') || el.id === 'provider-mini-panel';
            if (!isTracked || el.classList.contains('hidden')) return;
            // إعطاء المتصفح فرصة لحساب الأبعاد النهائية بعد الظهور قبل الفحص
            requestAnimationFrame(function () { clampElementToViewport(el); });
        });
    });

    function initObservers() {
        document.querySelectorAll('.panel-right').forEach(function (p) {
            bodyObserver.observe(p, { attributes: true });
        });
        const provider = document.getElementById('provider-mini-panel');
        if (provider) bodyObserver.observe(provider, { attributes: true });

        // فحص أولي عند التحميل (مثلاً لوحة مزود الخدمة قد تظهر تلقائياً بعد تسجيل الدخول)
        setTimeout(clampAllVisible, 800);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initObservers);
    } else {
        initObservers();
    }
})();