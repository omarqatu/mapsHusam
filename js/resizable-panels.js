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

    function restoreSize(panel) {
        if (!panel.id) return;
        try {
            const saved = localStorage.getItem('panel_size_' + panel.id);
            if (!saved) return;
            const size = JSON.parse(saved);
            if (size && size.width) panel.style.width = size.width;
            if (size && size.height) panel.style.height = size.height;
        } catch (err) { /* تجاهل أي خطأ تخزين أو تحليل */ }
    }

    function watchResize(panel) {
        if (!panel.id || typeof window.ResizeObserver === 'undefined') return;

        let debounceToken = null;
        const observer = new ResizeObserver(function () {
            clearTimeout(debounceToken);
            debounceToken = setTimeout(function () {
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
        document.querySelectorAll('.panel-right').forEach(function (panel) {
            restoreSize(panel);
            watchResize(panel);
        });
    }

    document.addEventListener('DOMContentLoaded', init);
})();