/**
 * ui-collapse.js
 * يضيف زر تصغير/تكبير لأربع مجموعات تحكم أعلى الخريطة.
 * - في حالة "مفتوح": دائرة صغيرة بها إشارة (−) فقط.
 * - في حالة "مصغّر": مربع بداخله إشارة (+) ونص يوضح اسم المجموعة.
 * ويحفظ حالة كل مجموعة في localStorage لتبقى محفوظة بين الزيارات.
 *
 * المجموعات:
 * 1) #user-top-badge-container  → "الملف الشخصي للمستخدم"
 * 2) #map-header                → "مربع عمليات الخريطة"
 * 3) .quick-search-wrapper      → "شريط البحث السريع"
 * 4) .ol-zoom                   → "أزرار الخريطة" (تُنشأ ديناميكياً من OpenLayers)
 */
(function () {
    'use strict';

    function addCollapseToggle(target, storageKey, labelText, onToggle) {
        if (!target || target.querySelector(':scope > .ui-collapse-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-collapse-btn';
        btn.setAttribute('aria-label', 'تصغير/تكبير ' + labelText);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'ui-collapse-icon';
        iconSpan.textContent = '−';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'ui-collapse-label';
        labelSpan.textContent = labelText;

        btn.appendChild(iconSpan);
        btn.appendChild(labelSpan);
        btn.title = 'تصغير';

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const isCollapsed = target.classList.toggle('ui-group-collapsed');
            iconSpan.textContent = isCollapsed ? '+' : '−';
            btn.title = isCollapsed ? 'تكبير' : 'تصغير';

            if (storageKey) {
                try {
                    localStorage.setItem(storageKey, isCollapsed ? '1' : '0');
                } catch (err) { /* تجاهل أي خطأ تخزين */ }
            }

            if (typeof onToggle === 'function') {
                onToggle(isCollapsed);
            }
        });

        target.appendChild(btn);

        // استرجاع الحالة المحفوظة سابقاً من زيارة سابقة
        if (storageKey) {
            try {
                if (localStorage.getItem(storageKey) === '1') {
                    target.classList.add('ui-group-collapsed');
                    iconSpan.textContent = '+';
                    btn.title = 'تكبير';
                    if (typeof onToggle === 'function') {
                        onToggle(true);
                    }
                }
            } catch (err) { /* تجاهل */ }
        }
    }

    function initStaticGroups() {
        addCollapseToggle(document.getElementById('user-top-badge-container'), 'ui_collapsed_profile', 'الملف الشخصي للمستخدم');

        // مربع عمليات الخريطة يضم أيضاً قائمة الأزرار (#top-buttons-container)
        // وأي لوحة فُتحت من خلالها (بحث، بحث بالموقع، طبقات، قياس، تحرير...)،
        // لذلك عند تصغيره يجب إغلاق كل اللوحات المفتوحة تحته تلقائياً.
        addCollapseToggle(document.getElementById('map-header'), 'ui_collapsed_search', 'مربع عمليات الخريطة', function (isCollapsed) {
            if (isCollapsed && typeof window.closeAllPanels === 'function') {
                window.closeAllPanels();
            }
        });

        addCollapseToggle(document.querySelector('.quick-search-wrapper'), 'ui_collapsed_quicksearch', 'شريط البحث السريع');
    }

    function initMapToolsGroup() {
        // .ol-zoom يُنشأ ديناميكياً بواسطة مكتبة OpenLayers بعد تحميل الخريطة،
        // لذلك ننتظر ظهوره في الـ DOM قبل إضافة زر التصغير عليه.
        function tryInit() {
            const zoomEl = document.querySelector('.ol-zoom');
            if (zoomEl) {
                addCollapseToggle(zoomEl, 'ui_collapsed_maptools', 'أزرار الخريطة');
                return true;
            }
            return false;
        }

        if (tryInit()) return;

        const observer = new MutationObserver(function () {
            if (tryInit()) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });

        // مهلة أمان لإيقاف المراقبة حتى لو لم تظهر العناصر لأي سبب
        setTimeout(function () { observer.disconnect(); }, 20000);
    }

    document.addEventListener('DOMContentLoaded', function () {
        initStaticGroups();
        initMapToolsGroup();
    });
})();