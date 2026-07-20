/**
 * ui-collapse.js
 */
(function () {
    'use strict';

    // ==========================================================================
    // آلية التصغير/التكبير بالمكان (تُستخدم فقط للمجموعات الثلاث: مربع عمليات
    // الخريطة، شريط البحث السريع، أزرار الخريطة)
    // ==========================================================================
    function addCollapseToggle(target, storageKey, labelText, onToggle) {
        if (!target || target.querySelector(':scope > .ui-collapse-btn')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ui-collapse-btn';
        btn.setAttribute('aria-label', 'تصغير/تكبير ' + labelText);

        const iconSpan = document.createElement('span');
        iconSpan.className = 'ui-collapse-icon';

        const labelSpan = document.createElement('span');
        labelSpan.className = 'ui-collapse-label';
        labelSpan.textContent = labelText;

        btn.appendChild(iconSpan);
        btn.appendChild(labelSpan);

        function applyState(isCollapsed) {
            target.classList.toggle('ui-group-collapsed', isCollapsed);
            iconSpan.textContent = isCollapsed ? '+' : '−';
            btn.title = isCollapsed ? 'تكبير' : 'تصغير';
            if (typeof onToggle === 'function') {
                onToggle(isCollapsed);
            }
        }

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();

            const isCollapsed = !target.classList.contains('ui-group-collapsed');
            applyState(isCollapsed);

            if (storageKey) {
                try {
                    localStorage.setItem(storageKey, isCollapsed ? '1' : '0');
                } catch (err) { /* تجاهل أي خطأ تخزين */ }
            }
        });

        target.appendChild(btn);

        // 🆕 الوضع الافتراضي: مصغّر دائماً عند أول زيارة (قبل أي اختيار يدوي
        // من المستخدم). إذا سبق واختار المستخدم فتحها أو تصغيرها، نحترم اختياره.
        let storedVal = null;
        if (storageKey) {
            try {
                storedVal = localStorage.getItem(storageKey);
            } catch (err) { /* تجاهل */ }
        }
        const shouldCollapse = (storedVal === null) ? true : (storedVal === '1');
        applyState(shouldCollapse);
    }

    function initStaticGroups() {
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
        // (مثلاً صفحة لا تحتوي خريطة إطلاقاً كصفحة البحث بدون خريطة)
        setTimeout(function () { observer.disconnect(); }, 20000);
    }

    // ==========================================================================
    // 🆕 نقل زرَي "دليل الاستخدام" و"تواصل معنا عبر فيسبوك" (إن وُجدا بالصفحة)
    // إلى داخل بوابة الملف الشخصي، مع الحفاظ التام على نفس العنصر (id، وأي
    // مستمع أحداث مرتبط به) - فقط تغيير مكانه في الصفحة وتنسيقه ليتناسب مع
    // شكل البوابة.
    // ==========================================================================
    function relocateGuideAndFacebookButtons(drawerBody) {
        const guideBtn = document.getElementById('btn-user-guide');
        const oldWrapper = document.getElementById('guide-contact-floating-buttons');
        const fbLink = oldWrapper ? oldWrapper.querySelector('a[href*="facebook.com"]') : null;

        if (!guideBtn && !fbLink) return; // الصفحة لا تحتوي هذه الأزرار أصلاً (مثل صفحة البحث بدون خريطة)

        const divider = document.createElement('hr');
        divider.className = 'ui-profile-drawer-divider';
        drawerBody.appendChild(divider);

        if (guideBtn) {
            guideBtn.className = 'btn-guide-top';
            guideBtn.innerHTML = '<i class="fas fa-book"></i> دليل الاستخدام';
            drawerBody.appendChild(guideBtn);
        }

        if (fbLink) {
            fbLink.className = 'btn-fb-top';
            fbLink.innerHTML = '<i class="fab fa-facebook-f"></i> تواصل معنا عبر فيسبوك';
            drawerBody.appendChild(fbLink);
        }
    }

    // ==========================================================================
    // 🆕 بوابة الملف الشخصي الجانبية (تحل محل التصغير/التكبير بالمكان القديم
    // لمجموعة #user-top-badge-container فقط)
    // ==========================================================================
    function initProfileDrawer() {
        const container = document.getElementById('user-top-badge-container');
        if (!container || container.querySelector(':scope > .ui-profile-toggle-btn')) return;

        // تغليف كل محتوى البادج الأصلي (الاسم، الرتبة، الأزرار) داخل جسم
        // البوابة الجانبية بدون فقدان أي معرفات (id) أو أحداث (onclick)
        // مرتبطة بها - فقط يتم نقل نفس العناصر لداخل حاوية جديدة
        const drawerBody = document.createElement('div');
        drawerBody.className = 'ui-profile-drawer-body';

        const title = document.createElement('div');
        title.className = 'ui-profile-drawer-title';
        title.innerHTML = '<i class="fas fa-id-badge"></i> الملف الشخصي';
        drawerBody.appendChild(title);

        while (container.firstChild) {
            drawerBody.appendChild(container.firstChild);
        }

        // 🆕 نقل زرَي دليل الاستخدام وتواصل معنا فيسبوك (إن وُجدا) إلى نهاية البوابة
        relocateGuideAndFacebookButtons(drawerBody);

        const toggleBtn = document.createElement('button');
        toggleBtn.type = 'button';
        toggleBtn.className = 'ui-profile-toggle-btn';
        toggleBtn.setAttribute('aria-label', 'فتح/إغلاق الملف الشخصي');
        toggleBtn.innerHTML = '<i class="fas fa-user"></i>';

        container.appendChild(toggleBtn);
        container.appendChild(drawerBody);

        function setOpen(isOpen) {
            container.classList.toggle('ui-profile-open', isOpen);
            toggleBtn.innerHTML = isOpen ? '<i class="fas fa-times"></i>' : '<i class="fas fa-user"></i>';
            toggleBtn.title = isOpen ? 'إغلاق' : 'الملف الشخصي';
            try {
                localStorage.setItem('ui_profile_drawer_open', isOpen ? '1' : '0');
            } catch (err) { /* تجاهل */ }
        }

        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(!container.classList.contains('ui-profile-open'));
        });

        // إغلاق البوابة تلقائياً عند النقر خارجها
        document.addEventListener('click', function (e) {
            if (!container.classList.contains('ui-profile-open')) return;
            if (container.contains(e.target)) return;
            setOpen(false);
        });

        // إغلاق البوابة عند الضغط على مفتاح Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && container.classList.contains('ui-profile-open')) {
                setOpen(false);
            }
        });

        // 🆕 الوضع الافتراضي: مغلقة (مصغّرة) دائماً عند أول زيارة، وتحترم
        // اختيار المستخدم إن كان قد تركها مفتوحة سابقاً
        let storedVal = null;
        try {
            storedVal = localStorage.getItem('ui_profile_drawer_open');
        } catch (err) { /* تجاهل */ }
        setOpen(storedVal === '1');
    }

    document.addEventListener('DOMContentLoaded', function () {
        initStaticGroups();
        initMapToolsGroup();
        initProfileDrawer();
    });
})();