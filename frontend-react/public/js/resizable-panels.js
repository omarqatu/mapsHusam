/**
 * resizable-panels.js
 * يعمل مع resizable-panels.css: يحفظ الحجم (العرض/الطول) الذي يختاره
 * المستخدم يدوياً بسحب زاوية أي لوحة (.panel-right)، ويستعيده تلقائياً
 * في الزيارة القادمة، لكل لوحة على حدة (بحث، طبقات، قياس، تحرير...).
 *
 * لا حاجة لأي إعداد إضافي: فقط أضف هذا السكربت بعد main.js.
 */
(function () {
    'use strict';

    function safeClamp(panel) {
        if (typeof window.clampElementToViewport === 'function') {
            window.clampElementToViewport(panel);
        }
    }

    function restoreSize(panel) {
        if (!panel.id) return;
        try {
            const saved = localStorage.getItem('panel_size_' + panel.id);
            if (!saved) return;
            const size = JSON.parse(saved);
            if (size && size.width) panel.style.width = size.width;
            if (size && size.height) panel.style.height = size.height;
            // 🛡️ حجم محفوظ من شاشة أكبر قد يجعل اللوحة تتجاوز حدود الشاشة الحالية
            // (خصوصاً من الأسفل، لأن max-height بالـ CSS لا يأخذ موضع top الحالي بالحسبان)
            requestAnimationFrame(function () { safeClamp(panel); });
        } catch (err) { /* تجاهل أي خطأ تخزين أو تحليل */ }
    }

    function watchResize(panel) {
        if (!panel.id || typeof window.ResizeObserver === 'undefined') return;

        let debounceToken = null;
        const observer = new ResizeObserver(function () {
            if (document.body.classList.contains('mobile-tabs-portrait') || document.body.classList.contains('mobile-tabs-landscape')) return;

            safeClamp(panel);

            clearTimeout(debounceToken);
            debounceToken = setTimeout(function () {
                if (document.body.classList.contains('mobile-tabs-portrait') || document.body.classList.contains('mobile-tabs-landscape')) return;
                const rect = panel.getBoundingClientRect();
                try {
                    localStorage.setItem('panel_size_' + panel.id, JSON.stringify({
                        width: Math.round(rect.width) + 'px',
                        height: Math.round(rect.height) + 'px'
                    }));
                } catch (err) { /* تجاهل */ }
            }, 300);
        });

        observer.observe(panel);
    }
    
    function init() {
    document.querySelectorAll('.panel-right:not(#provider-mini-panel)').forEach(function (panel) {
        restoreSize(panel);
        watchResize(panel);
    });
        }

    document.addEventListener('DOMContentLoaded', init);
})();