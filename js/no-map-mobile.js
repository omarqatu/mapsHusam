/**
 * js/no-map-mobile.js
 * ------------------------------------------------------------------
 * نظام الموبايل الموحّد لصفحة "البحث بدون خريطة" - يحل محل كل قواعد
 * @media الموجودة سابقاً في no-map-search.css.
 *
 * 🆕 نسخة مُحسَّنة للأداء (تحل مشكلة تعليق المتصفح عند التحويل لوضع
 * الموبايل):
 * - السحب (تكبير/تصغير لوحة الفلاتر) يمر عبر requestAnimationFrame بدل
 *   التنفيذ المباشر مع كل حدث touchmove/mousemove (كان هذا يسبب تعليقاً
 *   فعلياً أثناء السحب لأنه كان يفرض إعادة حساب Layout يدوياً - عبر
 *   getComputedStyle - مع كل بكسل حركة).
 * - مراقبة ظهور/اختفاء لوحة النتائج تُوقِف نفسها مؤقتاً أثناء تعديلها
 *   لكلاسات العنصر نفسه، بنفس الأسلوب المُجرَّب في mobile-tabs.js
 *   (pause/resume)، لمنع أي احتمال لدورة أحداث متكررة.
 * ------------------------------------------------------------------
 */
(function () {
    'use strict';

    // ==========================================================================
    // 1) حقن ورقة الأنماط الموحّدة (بدون أي @media - فقط قواعد مشروطة بكلاس body)
    // ==========================================================================
    function injectMobileStyles() {
        if (document.getElementById('nms-mobile-injected-style')) return;
        const style = document.createElement('style');
        style.id = 'nms-mobile-injected-style';
        style.innerHTML = `
            body.nms-hide-ads .nms-ad-side { display: none !important; }

            body.nms-mobile .nms-layout { flex-direction: column !important; padding: 0 12px !important; }
            body.nms-mobile .nms-hero-content { padding: 20px 18px !important; }
            body.nms-mobile .nms-categories-grid { grid-template-columns: repeat(auto-fill, minmax(105px, 1fr)) !important; }
            body.nms-mobile .nms-category-card { padding: 14px 8px !important; }
            body.nms-mobile .nms-category-card i { width: 42px !important; height: 42px !important; font-size: 20px !important; }
            body.nms-mobile .nms-results-list { grid-template-columns: 1fr !important; }
            body.nms-mobile .nms-select, body.nms-mobile .nms-value-container { min-width: 0 !important; width: 100% !important; }
            body.nms-mobile .nms-site-footer { padding: 30px 15px !important; }
            body.nms-mobile .nms-footer-container { grid-template-columns: 1fr !important; gap: 30px !important; text-align: right !important; }

            body.nms-mobile .market-main-header { flex-direction: column !important; align-items: stretch !important; }
            body.nms-mobile .market-logo-area { justify-content: center !important; order: 1 !important; }
            body.nms-mobile .market-search-box { max-width: 100% !important; order: 2 !important; }
            body.nms-mobile .market-actions-area { order: 3 !important; justify-content: center !important; }
            body.nms-mobile .market-nav-container { justify-content: flex-start !important; }

            body.nms-mobile-sm .nms-topbar-action-btn span { display: none !important; }
            body.nms-mobile-sm .nms-topbar-action-btn { padding: 8px 10px !important; }
            body.nms-mobile-sm .nms-back-home { padding: 8px 10px !important; }

            body.nms-mobile .nms-filters-box.nms-sheet {
                position: fixed !important;
                z-index: 7000 !important;
                background: #fff !important;
                box-shadow: 0 -6px 20px rgba(0,0,0,0.2) !important;
                overflow-y: auto !important;
                transition: none !important;
                margin: 0 !important;
                box-sizing: border-box !important;
                will-change: height, width;
            }
            body.nms-mobile-portrait .nms-filters-box.nms-sheet {
                left: 0 !important; right: 0 !important; bottom: 0 !important; top: auto !important;
                width: 100% !important;
                border-radius: 16px 16px 0 0 !important;
                height: var(--nms-sheet-size, 12vh) !important;
                max-height: 88vh !important;
            }
            body.nms-mobile-landscape .nms-filters-box.nms-sheet {
                top: 0 !important; right: 0 !important; bottom: 0 !important; left: auto !important;
                height: 100% !important;
                border-radius: 16px 0 0 16px !important;
                width: var(--nms-sheet-size, 14vw) !important;
                max-width: 88vw !important;
            }

            #nms-sheet-handle {
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: ns-resize;
                touch-action: none;
                user-select: none;
                padding: 8px 0 4px;
                background: #f4f6f8;
                border-radius: 16px 16px 0 0;
            }
            body.nms-mobile-landscape #nms-sheet-handle { cursor: ew-resize; border-radius: 16px 0 0 16px; }
            #nms-sheet-handle .nms-sheet-pill { width: 44px; height: 5px; border-radius: 4px; background: #cfd4da; }
            body.nms-mobile-landscape #nms-sheet-handle .nms-sheet-pill { width: 5px; height: 44px; }
            #nms-sheet-handle .nms-sheet-label { font-size: 12px; font-weight: bold; color: #555; margin-right: 8px; }

            body.nms-mobile-portrait #nms-results-view.nms-has-sheet-space { padding-bottom: 14vh !important; }
            body.nms-mobile-landscape #nms-results-view.nms-has-sheet-space { padding-left: 14vw !important; box-sizing: border-box !important; }

            body.nms-sheet-animating .nms-filters-box.nms-sheet { transition: height 0.2s ease, width 0.2s ease !important; }
        `;
        document.head.appendChild(style);
    }

    // ==========================================================================
    // 2) مراقبة حجم الشاشة (مُهدَّأة/debounced) وتحديث كلاسات body
    // ==========================================================================
    let mqHideAds, mqMobile, mqSmall, mqPortrait;
    let applyScheduled = false;

    function scheduleApply() {
        if (applyScheduled) return;
        applyScheduled = true;
        requestAnimationFrame(function () {
            applyScheduled = false;
            applyBodyClasses();
        });
    }

    function applyBodyClasses() {
        document.body.classList.toggle('nms-hide-ads', mqHideAds.matches);
        document.body.classList.toggle('nms-mobile', mqMobile.matches);
        document.body.classList.toggle('nms-mobile-sm', mqSmall.matches);

        const isMobile = mqMobile.matches;
        const isPortrait = mqPortrait.matches;
        document.body.classList.toggle('nms-mobile-portrait', isMobile && isPortrait);
        document.body.classList.toggle('nms-mobile-landscape', isMobile && !isPortrait);

        syncFilterSheet();
    }

    // ==========================================================================
    // 3) تحويل صندوق الفلاتر إلى لوحة سفلية/جانبية قابلة للسحب على الموبايل
    // ==========================================================================
    let sheetHandle = null;
    let sheetInitialized = false;
    let isDragging = false;

    function ensureSheetHandle(filtersBox) {
        if (sheetHandle) return;
        sheetHandle = document.createElement('div');
        sheetHandle.id = 'nms-sheet-handle';
        sheetHandle.innerHTML = '<span class="nms-sheet-pill"></span><span class="nms-sheet-label">فلترة النتائج (اسحب للتكبير)</span>';
        filtersBox.insertBefore(sheetHandle, filtersBox.firstChild);
        setupDrag();
    }

    function currentSizeVal() {
        const isPortrait = document.body.classList.contains('nms-mobile-portrait');
        const raw = document.body.style.getPropertyValue('--nms-sheet-size');
        const parsed = parseFloat(raw);
        return isNaN(parsed) ? (isPortrait ? 12 : 14) : parsed;
    }

    function setSizeVal(num) {
        const isPortrait = document.body.classList.contains('nms-mobile-portrait');
        document.body.style.setProperty('--nms-sheet-size', num + (isPortrait ? 'vh' : 'vw'));
    }

    // 🆕 السحب يمر بالكامل عبر requestAnimationFrame: نخزّن آخر قيمة مطلوبة
    // فقط (pendingSize)، ونطبّقها مرة واحدة لكل إطار رسم، بدل تنفيذ حساب
    // ورندر كامل مع كل بكسل حركة إصبع/ماوس (هذا كان السبب الرئيسي للتعليق).
    function setupDrag() {
        let startCoord = 0, startSize = 0;
        let pendingSize = null;
        let rafToken = false;

        function applyPending() {
            rafToken = false;
            if (pendingSize === null) return;
            setSizeVal(pendingSize);
        }

        function onDown(e) {
            isDragging = true;
            const point = e.touches ? e.touches[0] : e;
            const isPortrait = document.body.classList.contains('nms-mobile-portrait');
            startCoord = isPortrait ? point.clientY : point.clientX;
            startSize = currentSizeVal();
            try { sheetHandle.setPointerCapture && e.pointerId && sheetHandle.setPointerCapture(e.pointerId); } catch (err) {}
        }

        function onMove(e) {
            if (!isDragging) return;
            const point = e.touches ? e.touches[0] : e;
            const isPortrait = document.body.classList.contains('nms-mobile-portrait');
            const span = isPortrait ? window.innerHeight : window.innerWidth;
            const coord = isPortrait ? point.clientY : point.clientX;
            const deltaPercent = ((startCoord - coord) / span) * 100;
            let newSize = startSize + deltaPercent;
            newSize = Math.max(8, Math.min(85, newSize));
            pendingSize = newSize;
            if (!rafToken) { rafToken = true; requestAnimationFrame(applyPending); }
            if (e.cancelable) e.preventDefault();
        }

        function onUp() {
            if (!isDragging) return;
            isDragging = false;
            pendingSize = null;
            const cur = currentSizeVal();
            const isPortrait = document.body.classList.contains('nms-mobile-portrait');
            const snaps = isPortrait ? [12, 45, 80] : [14, 40, 70];
            let nearest = snaps[0];
            snaps.forEach(function (s) { if (Math.abs(s - cur) < Math.abs(nearest - cur)) nearest = s; });

            document.body.classList.add('nms-sheet-animating');
            setSizeVal(nearest);
            setTimeout(function () { document.body.classList.remove('nms-sheet-animating'); }, 220);
        }

        sheetHandle.addEventListener('mousedown', onDown);
        sheetHandle.addEventListener('touchstart', onDown, { passive: true });
        document.addEventListener('mousemove', onMove);
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchend', onUp);
        document.addEventListener('touchcancel', onUp);

        // نقرة بسيطة (بدون سحب فعلي) تنقّل بين ثلاث أحجام جاهزة
        let clickMoved = false;
        sheetHandle.addEventListener('click', function () {
            if (isDragging || clickMoved) { clickMoved = false; return; }
            const cur = currentSizeVal();
            const isPortrait = document.body.classList.contains('nms-mobile-portrait');
            const snaps = isPortrait ? [12, 45, 80] : [14, 40, 70];
            let idx = snaps.findIndex(function (s) { return Math.abs(s - cur) < 2; });
            if (idx === -1) idx = 0;
            idx = (idx + 1) % snaps.length;
            document.body.classList.add('nms-sheet-animating');
            setSizeVal(snaps[idx]);
            setTimeout(function () { document.body.classList.remove('nms-sheet-animating'); }, 220);
        });
    }

    // ==========================================================================
    // 4) مزامنة حالة اللوحة (تُوقِف مراقبها مؤقتاً أثناء تعديل الكلاسات بنفس
    // أسلوب pause/resume المُجرَّب في mobile-tabs.js لضمان عدم أي دورة أحداث)
    // ==========================================================================
    let resultsObserver = null;
    let resultsViewEl = null;

    function syncFilterSheet() {
        const filtersBox = document.querySelector('.nms-filters-box');
        if (!filtersBox || !resultsViewEl) return;

        const isMobile = document.body.classList.contains('nms-mobile');
        const resultsVisible = !resultsViewEl.classList.contains('hidden');

        if (resultsObserver) resultsObserver.disconnect();

        if (isMobile && resultsVisible) {
            filtersBox.classList.add('nms-sheet');
            resultsViewEl.classList.add('nms-has-sheet-space');
            ensureSheetHandle(filtersBox);
            if (!sheetInitialized) {
                sheetInitialized = true;
                const isPortrait = document.body.classList.contains('nms-mobile-portrait');
                setSizeVal(isPortrait ? 12 : 14);
            }
        } else {
            filtersBox.classList.remove('nms-sheet');
            resultsViewEl.classList.remove('nms-has-sheet-space');
        }

        if (resultsObserver) resultsObserver.observe(resultsViewEl, { attributes: true, attributeFilter: ['class'] });
    }

    function observeResultsView() {
        resultsViewEl = document.getElementById('nms-results-view');
        if (!resultsViewEl) return;
        resultsObserver = new MutationObserver(function () { syncFilterSheet(); });
        resultsObserver.observe(resultsViewEl, { attributes: true, attributeFilter: ['class'] });
    }

    // ==========================================================================
    // 5) نقطة البداية
    // ==========================================================================
    function init() {
        injectMobileStyles();

        mqHideAds = window.matchMedia('(max-width: 992px)');
        mqMobile = window.matchMedia('(max-width: 768px)');
        mqSmall = window.matchMedia('(max-width: 560px)');
        mqPortrait = window.matchMedia('(orientation: portrait)');

        [mqHideAds, mqMobile, mqSmall, mqPortrait].forEach(function (mq) {
            if (mq.addEventListener) mq.addEventListener('change', scheduleApply);
            else mq.addListener(scheduleApply);
        });

        window.addEventListener('resize', function () {
            clearTimeout(window.__nmsMobileResizeTimer);
            window.__nmsMobileResizeTimer = setTimeout(scheduleApply, 200);
        });
        window.addEventListener('orientationchange', function () {
            setTimeout(scheduleApply, 300);
        });

        observeResultsView();
        applyBodyClasses();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();