/**
 * ui-collapse.js
 * ------------------------------------------------------------------
 * 🆕 تحسين هام مضاف هنا (إصلاح تعارض CSS عند التصغير):
 * سابقاً كانت حالة "مصغّر" تعتمد فقط على كلاس CSS (.ui-group-collapsed)
 * الذي يفرض width: auto !important. لكن في وضع الموبايل، ملف mobile-tabs.css
 * يحتوي قاعدة أعلى تخصيصاً (ID + كلاس body):
 *      body.mobile-tabs-portrait #map-header { width: 92% !important; }
 * وهذه كانت تتغلب على كلاس .ui-group-collapsed رغم كلاهما !important،
 * لأن التخصيص (specificity) للقاعدة الخارجية أعلى.
 *
 * الحل: عند التصغير، نفرض الآن width بأسلوب inline عبر
 * style.setProperty('width', 'auto', 'important'). الأسلوب المضمّن (inline)
 * بأولوية !important يتفوق دائماً على أي قاعدة !important في ملفات CSS
 * خارجية بغض النظر عن تخصيصها، فيصبح الانكماش الفعلي مضموناً 100% في كل
 * الحالات (مربع عمليات الخريطة، شريط البحث السريع، أزرار الخريطة).
 * عند إعادة التكبير، نُزيل هذا الـ override يدوياً لنعيد التحكم الكامل
 * لملفات CSS الخارجية كما كان قبل هذا التعديل.
 * ------------------------------------------------------------------
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

            // 🆕 فرض/إزالة override الأولوية القصوى للعرض لضمان الانكماش الفعلي
            // حتى لو وُجدت قاعدة CSS خارجية بتخصيص أعلى وبنفس أولوية !important
            // (مثل حالة #map-header في وضع الموبايل).
            if (isCollapsed) {
                target.style.setProperty('width', 'auto', 'important');
            } else {
                target.style.removeProperty('width');
            }

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

        // ==================================================================
        // 🆕 تفعيل سحب أيقونة الملف الشخصي نفسها (تبقى بنفس الشكل والمكان
        // الافتراضي دائماً عند أول زيارة، وتحترم آخر موضع حرّكه المستخدم
        // يدوياً لاحقاً - نفس فلسفة باقي اللوحات القابلة للسحب بالمنصة)
        // ==================================================================
        let toggleWasDragged = false;

        (function makeProfileToggleDraggable() {
            let isDragging = false;
            let offsetX = 0, offsetY = 0;
            let startX = 0, startY = 0;
            const DRAG_THRESHOLD = 6;

            function setImportantStyle(el, prop, value) {
                el.style.setProperty(prop, value, 'important');
            }

            function onDown(e) {
                const point = e.touches ? e.touches[0] : e;
                isDragging = true;
                toggleWasDragged = false;
                const rect = toggleBtn.getBoundingClientRect();
                offsetX = point.clientX - rect.left;
                offsetY = point.clientY - rect.top;
                startX = point.clientX;
                startY = point.clientY;

                document.addEventListener('mousemove', onMove);
                document.addEventListener('mouseup', onUp);
                document.addEventListener('touchmove', onMove, { passive: false });
                document.addEventListener('touchend', onUp);
            }

            function onMove(e) {
                if (!isDragging) return;
                const point = e.touches ? e.touches[0] : e;
                const dx = point.clientX - startX;
                const dy = point.clientY - startY;

                if (!toggleWasDragged && (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD)) {
                    toggleWasDragged = true;
                }
                if (!toggleWasDragged) return;
                if (e.cancelable) e.preventDefault();

                let newLeft = point.clientX - offsetX;
                let newTop = point.clientY - offsetY;

                const maxLeft = window.innerWidth - toggleBtn.offsetWidth;
                const maxTop = window.innerHeight - toggleBtn.offsetHeight;
                newLeft = Math.max(0, Math.min(newLeft, maxLeft));
                newTop = Math.max(0, Math.min(newTop, maxTop));

                setImportantStyle(toggleBtn, 'position', 'fixed');
                setImportantStyle(toggleBtn, 'left', newLeft + 'px');
                setImportantStyle(toggleBtn, 'top', newTop + 'px');
                setImportantStyle(toggleBtn, 'right', 'auto');
                setImportantStyle(toggleBtn, 'bottom', 'auto');
            }

            function onUp() {
                if (!isDragging) return;
                isDragging = false;
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.removeEventListener('touchmove', onMove);
                document.removeEventListener('touchend', onUp);

                if (toggleWasDragged) {
                    try {
                        localStorage.setItem('ui_profile_toggle_pos', JSON.stringify({
                            left: toggleBtn.style.left,
                            top: toggleBtn.style.top
                        }));
                    } catch (err) { /* تجاهل */ }
                }
            }

            toggleBtn.addEventListener('mousedown', onDown);
            toggleBtn.addEventListener('touchstart', onDown, { passive: true });

            // استعادة آخر موضع محفوظ (إن وجد)، مع تصحيحه داخل حدود الشاشة الحالية
            try {
                const saved = localStorage.getItem('ui_profile_toggle_pos');
                if (saved) {
                    const pos = JSON.parse(saved);
                    if (pos && pos.left && pos.top) {
                        setImportantStyle(toggleBtn, 'position', 'fixed');
                        setImportantStyle(toggleBtn, 'left', pos.left);
                        setImportantStyle(toggleBtn, 'top', pos.top);
                        setImportantStyle(toggleBtn, 'right', 'auto');
                        setImportantStyle(toggleBtn, 'bottom', 'auto');
                        requestAnimationFrame(function () {
                            if (typeof window.clampElementToViewport === 'function') {
                                window.clampElementToViewport(toggleBtn);
                            }
                        });
                    }
                }
            } catch (err) { /* تجاهل */ }
        })();

        toggleBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            // 🆕 لا نفتح/نغلق البوابة إذا كانت آخر حركة "سحب" فعلي وليس نقرة عادية
            if (toggleWasDragged) {
                toggleWasDragged = false;
                return;
            }
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