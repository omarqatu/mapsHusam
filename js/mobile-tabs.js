/**
 * mobile-tabs.js (نسخة معاد بناؤها - أكثر أماناً واستقراراً)
 * نظام تبويبات للموبايل (عمودي وأفقي) مع صندوق قابل للسحب/التكبير.
 *
 * الفرق الجوهري عن النسخة السابقة:
 * - لا يبدأ العمل إطلاقاً إلا بعد اكتمال تسجيل الدخول فعلياً (حدث
 *   "userLoggedIn")، بدلاً من العمل من لحظة تحميل الصفحة. هذا يمنع أي
 *   تدخل أو تعارض مع شاشة الترحيب / شاشة تسجيل الدخول قبل دخول المستخدم
 *   فعلياً للمنصة، وهي كانت المصدر الأرجح للتعارض على الأجهزة الحقيقية.
 * - كل دالة رئيسية محمية بـ try/catch حتى لا يوقف أي خطأ بسيط باقي عمل
 *   الصفحة أو يسبب حالة "تجمّد" غير متوقعة.
 * - لا يتم نقل أي لوحة في الـ DOM إطلاقاً - فقط إضافة/إزالة صنف
 *   "mobile-tab-target" الذي يتحكم به ملف mobile-tabs.css بصرياً فقط.
 */
(function () {
    'use strict';

    const PANELS = [
        { id: 'search-panel', group: 'action', label: '🔎 البحث الذكي', closeSel: '#close-search-panel' },
        { id: 'nearby-apartments-panel', group: 'action', label: '📍 بحث الموقع', closeSel: '#close-nearby-panel' },
        { id: 'layerPanel', group: 'action', label: '📚 الطبقات', closeSel: '#close-layer-panel' },
        { id: 'measurePanel', group: 'action', label: '📏 القياس', closeSel: '#close-measure-panel' },
        { id: 'shareLocationPanel', group: 'action', label: '🔗 مشاركة الموقع', closeSel: '#close-share-panel' },
        { id: 'editPanel', group: 'edit', label: '📝 تحرير نقاط', closeSel: '#close-edit-panel' },
        { id: 'polygonEditPanel', group: 'edit', label: '🗺️ تحرير مضلعات', closeSel: '#close-polygon-edit-panel' },
        { id: 'lineEditPanel', group: 'edit', label: '🛣️ تحرير خطوط', closeSel: '#close-line-edit-panel' },
        { id: 'results-panel', group: 'results', label: '📋 النتائج', closeSel: '#close-results-panel' },
        { id: 'provider-mini-panel', group: 'provider', label: '🛠️ إدارة الخدمة', closeSel: null }
    ];

    const GROUP_ORDER = ['results', 'action', 'edit', 'provider'];
    const GROUP_FALLBACK_LABEL = {
        results: '📋 النتائج', action: '🧰 أدوات', edit: '✏️ التحرير', provider: '🛠️ إدارة الخدمة'
    };

    const SNAP_PORTRAIT = [8, 34, 82];   // vh
    const SNAP_LANDSCAPE = [10, 34, 62]; // vw

    let activeGroup = 'home';
    let mqPortrait, mqLandscape;
    let tabBar, tabHome, tabContent, tabArea;
    let observer = null;
    let lastVisibility = {};
    let mapUpdateScheduled = false;
    let dragging = false;
    let domBuilt = false;
    let systemStarted = false;

    function safe(fn) {
        return function () {
            try { return fn.apply(this, arguments); }
            catch (err) { console.warn('mobile-tabs.js: تم تجاهل خطأ غير متوقع لمنع تعطل الصفحة:', err); }
        };
    }

    function isMobileNow() {
        return !!((mqPortrait && mqPortrait.matches) || (mqLandscape && mqLandscape.matches));
    }
    function getOrientation() {
        return document.body.classList.contains('mobile-tabs-portrait') ? 'portrait' : 'landscape';
    }
    function isPanelVisible(el) {
        if (!el) return false;
        if (el.classList.contains('hidden')) return false;
        if (el.style && el.style.display === 'none') return false;
        return true;
    }
    // 🆕 فحص مباشر لدور المستخدم (بدل الاعتماد فقط على حالة CSS المتغيرة)
    // لجعل تبويبة "إدارة الخدمة" ثابتة الحضور دائماً لمزودي الخدمة، تماماً
    // كتبويبة الرئيسية، بغض النظر عن أي تأخير أو تعارض بتوقيت تحديث العرض.
    function isProviderRoleUser() {
        try {
            const saved = JSON.parse(localStorage.getItem('map_user')) || JSON.parse(sessionStorage.getItem('map_user'));
            return !!(saved && (saved.role === 'provider' || saved.account_type === 'provider'));
        } catch (e) { return false; }
    }

    function throttledUpdateMapSize() {
        if (mapUpdateScheduled) return;
        mapUpdateScheduled = true;
        requestAnimationFrame(function () {
            mapUpdateScheduled = false;
            if (window.map && typeof window.map.updateSize === 'function') {
                try { window.map.updateSize(); } catch (e) {}
            }
        });
    }
    function refreshMapSize() {
        throttledUpdateMapSize();
        setTimeout(throttledUpdateMapSize, 120);
        setTimeout(throttledUpdateMapSize, 400);
        setTimeout(throttledUpdateMapSize, 900);
    }

    /* -------------------- بناء الهيكل (مرة واحدة فقط) -------------------- */
    function buildDom() {
        if (domBuilt) return;
        if (!document.getElementById('map')) return;

        tabArea = document.createElement('div');
        tabArea.id = 'mobile-tab-area';

        const header = document.createElement('div');
        header.id = 'mobile-tab-header';

        const handle = document.createElement('div');
        handle.id = 'mobile-tab-handle';
        handle.innerHTML = '<span class="mt-handle-pill"></span>';

        tabBar = document.createElement('div');
        tabBar.id = 'mobile-tab-bar';

        header.appendChild(handle);
        header.appendChild(tabBar);

        tabContent = document.createElement('div');
        tabContent.id = 'mobile-tab-content';

        tabHome = document.createElement('div');
        tabHome.id = 'mobile-tab-home';
        tabHome.innerHTML =
            '<div class="mth-icon">🗺️</div>' +
            '<div class="mth-title">مرحباً بكم في خريطة الخدمات الفلسطينية</div>' +
            '<div class="mth-desc">اختر أي أداة من الأزرار أعلى الخريطة (بحث، طبقات، قياس، مشاركة موقع...) وستظهر هنا. اسحب المقبض بالأعلى لتكبير أو تصغير هذا الصندوق.</div>';

        tabContent.appendChild(tabHome);
        tabArea.appendChild(header);
        tabArea.appendChild(tabContent);
        document.body.appendChild(tabArea);

        setupDragHandle(handle);
        domBuilt = true;
    }

    /* -------------------- منطق التبويبات -------------------- */
    function computeVisibilityMap() {
        const map = {};
        PANELS.forEach(function (p) { map[p.id] = isPanelVisible(document.getElementById(p.id)); });
        return map;
    }
    function groupIsOpenInMap(map, group) {
        return PANELS.some(function (p) { return p.group === group && map[p.id]; });
    }
    function getVisiblePanelForGroup(group) {
        // 🆕 تبويبة مزود الخدمة: تُحدَّد فقط بدور المستخدم، بمعزل عن أي
        // حالة CSS متغيرة، لضمان ثباتها دائماً كتبويبة الرئيسية
        if (group === 'provider') {
            const el = document.getElementById('provider-mini-panel');
            return (el && isProviderRoleUser()) ? el : null;
        }
        for (let i = 0; i < PANELS.length; i++) {
            if (PANELS[i].group !== group) continue;
            const el = document.getElementById(PANELS[i].id);
            if (isPanelVisible(el)) return el;
        }
        return null;
    }
    function getGroupLabel(group) {
        const p = PANELS.find(function (p) { return p.group === group && isPanelVisible(document.getElementById(p.id)); });
        return p ? p.label : (GROUP_FALLBACK_LABEL[group] || group);
    }
    function closeGroup(group) {
        const p = PANELS.find(function (p) { return p.group === group && isPanelVisible(document.getElementById(p.id)); });
        if (!p || !p.closeSel) return;
        const btn = document.querySelector(p.closeSel);
        if (btn) btn.click();
    }

    function renderTabBar(currentMap) {
        if (!tabBar) return;
        tabBar.innerHTML = '';

        const homeBtn = document.createElement('button');
        homeBtn.type = 'button';
        homeBtn.className = 'mobile-tab-btn' + (activeGroup === 'home' ? ' active' : '');
        homeBtn.innerHTML = '🏠 الرئيسية';
        homeBtn.addEventListener('click', safe(function () { setActiveGroup('home'); }));
        tabBar.appendChild(homeBtn);

        GROUP_ORDER.forEach(function (group) {
            const shouldShow = (group === 'provider') ? isProviderRoleUser() : groupIsOpenInMap(currentMap, group);
            if (!shouldShow) return;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'mobile-tab-btn' + (activeGroup === group ? ' active' : '');
            btn.addEventListener('click', safe(function () { setActiveGroup(group); }));

            const labelSpan = document.createElement('span');
            labelSpan.textContent = getGroupLabel(group);
            btn.appendChild(labelSpan);

            if (group !== 'provider') {
                const closeSpan = document.createElement('span');
                closeSpan.className = 'mobile-tab-close';
                closeSpan.textContent = '×';
                closeSpan.addEventListener('click', safe(function (e) { e.stopPropagation(); closeGroup(group); }));
                btn.appendChild(closeSpan);
            }
            tabBar.appendChild(btn);
        });
    }

    function syncActivePanel() {
        const targetEl = activeGroup === 'home' ? null : getVisiblePanelForGroup(activeGroup);
        PANELS.forEach(function (p) {
            const el = document.getElementById(p.id);
            if (!el) return;
            if (el === targetEl) el.classList.add('mobile-tab-target');
            else el.classList.remove('mobile-tab-target');
        });
        if (tabHome) tabHome.style.display = (activeGroup === 'home') ? 'flex' : 'none';
        refreshMapSize();
    }

    function setActiveGroup(group) {
        pauseObserving(); // 🆕
        activeGroup = group;
        syncActivePanel();
        renderTabBar(computeVisibilityMap());
        resumeObserving(); // 🆕
    }

    function recomputeState() {
        pauseObserving(); // 🆕 إيقاف المراقبة مؤقتاً قبل أي تعديل نقوم به نحن

        const newMap = computeVisibilityMap();

        let newlyOpenedGroup = null;
        for (let i = 0; i < GROUP_ORDER.length; i++) {
            const group = GROUP_ORDER[i];
            // 🆕 لا نبدّل التبويب النشط تلقائياً بسبب ظهور تبويبة مزود الخدمة -
            // فهي تبويبة ثابتة دائمة مثل الرئيسية، لا تسرق التركيز من المستخدم
            if (group === 'provider') continue;
            const justOpened = PANELS.some(function (p) {
                return p.group === group && newMap[p.id] && !lastVisibility[p.id];
            });
            if (justOpened) { newlyOpenedGroup = group; break; }
        }

        lastVisibility = newMap;

        let nextGroup = activeGroup;
        if (newlyOpenedGroup) {
            nextGroup = newlyOpenedGroup;
        } else if (activeGroup !== 'home' && !groupIsOpenInMap(newMap, activeGroup)) {
            nextGroup = 'home';
            for (let i = 0; i < GROUP_ORDER.length; i++) {
                if (groupIsOpenInMap(newMap, GROUP_ORDER[i])) { nextGroup = GROUP_ORDER[i]; break; }
            }
        }

        activeGroup = nextGroup;
        syncActivePanel();
        renderTabBar(newMap);

        resumeObserving(); // 🆕 إعادة تفعيل المراقبة بعد ما خلصنا كل تعديلاتنا نحن
    }

    /* -------- ------------ المراقبة -------------------- */
    function startObserving() {
        if (observer) return;
        observer = new MutationObserver(safe(function () {
            if (!isMobileNow() || !systemStarted) return;
            recomputeState();
        }));
        observeAllPanels();
    }
    function stopObserving() {
        if (observer) { observer.disconnect(); observer = null; }
    }
    function observeAllPanels() {
        if (!observer) return;
        PANELS.forEach(function (p) {
            const el = document.getElementById(p.id);
            if (el) observer.observe(el, { attributes: true, attributeFilter: ['class', 'style'] });
        });
    }
    function pauseObserving() {
        if (observer) observer.disconnect();
    }
    function resumeObserving() {
        observeAllPanels();
    }

    /* -------------------- مقبض السحب -------------------- */
    function currentSizeNum() {
        const val = getComputedStyle(document.body).getPropertyValue('--mt-size').trim();
        return parseFloat(val) || 34;
    }
    function setSizeNum(orientation, num) {
        document.body.style.setProperty('--mt-size', num + (orientation === 'portrait' ? 'vh' : 'vw'));
    }
    function snapTo(orientation, num) {
        document.body.classList.add('mt-animate');
        setSizeNum(orientation, num);
        setTimeout(function () { document.body.classList.remove('mt-animate'); refreshMapSize(); }, 260);
    }

    function setupDragHandle(handle) {
        let startCoord = 0, startSize = 0;
        let pendingSize = null;
        let rafScheduled = false;

        function applyPending() {
            rafScheduled = false;
            if (pendingSize === null) return;
            setSizeNum(getOrientation(), pendingSize);
            throttledUpdateMapSize();
        }

        function onPointerDown(e) {
            dragging = true;
            const orientation = getOrientation();
            startCoord = orientation === 'portrait' ? e.clientY : e.clientX;
            startSize = currentSizeNum();
            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        }
        function onPointerMove(e) {
            if (!dragging) return;
            const orientation = getOrientation();
            const span = orientation === 'portrait' ? window.innerHeight : window.innerWidth;
            const coord = orientation === 'portrait' ? e.clientY : e.clientX;
            const deltaPx = startCoord - coord;
            const deltaPercent = (deltaPx / span) * 100;
            let newSize = startSize + deltaPercent;
            newSize = Math.max(6, Math.min(88, newSize));
            pendingSize = newSize;
            if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(applyPending); }
        }
        function onPointerUp() {
            if (!dragging) return;
            dragging = false;
            pendingSize = null;
            const orientation = getOrientation();
            const snaps = orientation === 'portrait' ? SNAP_PORTRAIT : SNAP_LANDSCAPE;
            const cur = currentSizeNum();
            let nearest = snaps[0];
            snaps.forEach(function (s) { if (Math.abs(s - cur) < Math.abs(nearest - cur)) nearest = s; });
            snapTo(orientation, nearest);
        }

        handle.addEventListener('pointerdown', safe(onPointerDown));
        handle.addEventListener('pointermove', safe(onPointerMove));
        handle.addEventListener('pointerup', safe(onPointerUp));
        handle.addEventListener('pointercancel', safe(onPointerUp));

        handle.addEventListener('click', safe(function () {
            if (dragging) return;
            const orientation = getOrientation();
            const snaps = orientation === 'portrait' ? SNAP_PORTRAIT : SNAP_LANDSCAPE;
            const cur = currentSizeNum();
            let idx = snaps.findIndex(function (s) { return Math.abs(s - cur) < 2; });
            if (idx === -1) idx = 1;
            idx = (idx + 1) % snaps.length;
            snapTo(orientation, snaps[idx]);
        }));
    }

    /* -------------------- تفعيل/إلغاء وضع الموبايل -------------------- */
    function applyModeClass() {
        if (!systemStarted) return; // 🆕 لا شيء يعمل قبل تسجيل الدخول فعلياً

        const portrait = mqPortrait.matches;
        const landscape = mqLandscape.matches;
        const wasMobile = document.body.classList.contains('mobile-tabs-portrait') || document.body.classList.contains('mobile-tabs-landscape');
        const isMobile = portrait || landscape;

        document.body.classList.toggle('mobile-tabs-portrait', portrait);
        document.body.classList.toggle('mobile-tabs-landscape', landscape);

        if (isMobile) {
            buildDom();
            if (!wasMobile) {
                setSizeNum(portrait ? 'portrait' : 'landscape', 34);
                activeGroup = 'home';
                lastVisibility = {};
                startObserving();
            }
            recomputeState();
        } else if (wasMobile) {
            stopObserving();
            PANELS.forEach(function (p) {
                const el = document.getElementById(p.id);
                if (el) el.classList.remove('mobile-tab-target');
            });
            activeGroup = 'home';
        }
        refreshMapSize();
    }

    /* -------------------- نقطة البداية الفعلية: فقط بعد تسجيل الدخول -------------------- */
    function startSystem() {
        if (systemStarted) return;
        systemStarted = true;

        mqPortrait = window.matchMedia('(max-width: 767px) and (orientation: portrait)');
        mqLandscape = window.matchMedia('(max-width: 900px) and (orientation: landscape)');

        applyModeClass();

        const onChange = safe(function () { applyModeClass(); });
        if (mqPortrait.addEventListener) {
            mqPortrait.addEventListener('change', onChange);
            mqLandscape.addEventListener('change', onChange);
        } else {
            mqPortrait.addListener(onChange);
            mqLandscape.addListener(onChange);
        }
        window.addEventListener('resize', safe(function () {
            clearTimeout(window.__mtResizeTimer);
            window.__mtResizeTimer = setTimeout(applyModeClass, 200);
        }));
        window.addEventListener('orientationchange', safe(function () { setTimeout(applyModeClass, 300); }));
    }

    // 🆕 الانتظار حتى اكتمال تسجيل الدخول فعلياً (يُطلق من auth-core-functions.js
    // داخل enterPlatform بعد ظهور #app-shell وتهيئة الخريطة). هذا يمنع أي تدخل
    // من هذا الملف على شاشات الترحيب/التسجيل قبل الدخول الفعلي للمنصة.
    document.addEventListener('userLoggedIn', safe(function () {
        // تأخير بسيط لضمان اكتمال رسم #app-shell وحساب أبعاد #map الحقيقية
        setTimeout(startSystem, 300);
    }));

    // 🛡️ شبكة أمان: لو لأي سبب لم يصل حدث userLoggedIn (مثلاً ترتيب تحميل
    // مختلف)، نتأكد كل ثانية إذا أصبح #app-shell ظاهراً فعلياً ونبدأ النظام
    // عندها تلقائياً، دون أي اعتماد كامل على توقيت حدث واحد فقط.
    const safetyInterval = setInterval(safe(function () {
        if (systemStarted) { clearInterval(safetyInterval); return; }
        const shell = document.getElementById('app-shell');
        if (shell && getComputedStyle(shell).display !== 'none') {
            clearInterval(safetyInterval);
            startSystem();
        }
    }), 1000);

    // 🆕 إصلاح دقة الارتفاع الحقيقي للشاشة على الموبايل (مشكلة 100vh
    // المعروفة بالمتصفحات، خصوصاً Safari، بسبب اختفاء/ظهور شريط العنوان).
    // نحسب ارتفاع البكسل الحقيقي ونخزنه كمتغير CSS يمكن استخدامه بدل vh.
    function setRealVh() {
        document.documentElement.style.setProperty('--real-vh', (window.innerHeight * 0.01) + 'px');
    }
    setRealVh();
    window.addEventListener('resize', safe(setRealVh));
    window.addEventListener('orientationchange', safe(function () { setTimeout(setRealVh, 300); }));
})();