/**
 * js/guest-mode.js
 * وضع الزائر بدون تسجيل: مزايا محددة فقط.
 *
 * ✅ مسموح للزائر: تصفح الخريطة والطبقات، كل أنواع البحث، عرض تفاصيل الإعلانات
 *    والصور والتقييمات، أدوات القياس ومشاركة الموقع، مركز المعلومات، الدليل
 *    والشروط، والتواصل مع إدارة المنصة.
 * 🔒 يتطلب تسجيل الدخول: أرقام التواصل مع المزودين/المعلنين (يحجبها السيرفر)،
 *    الاتصال/الواتساب، طلب الخدمة والدردشة، التقييم، الإشعارات، وإدارة الإعلانات.
 *
 * أي زر يحمل data-requires-login="اسم الميزة" (أو أزرار الاتصال/طلب الخدمة المعروفة)
 * يُعترض تلقائياً للزائر وتظهر له نافذة تدعوه للدخول أو التسجيل.
 */
(function () {
    'use strict';
    if (window.__guestModeLoaded) return;
    window.__guestModeLoaded = true;

    const GUEST_FLAG = 'guest_mode';
    const LOGIN_REQUIRED_SELECTORS = [
        '[data-requires-login]',
        '.popup-call-btn', '.popup-whatsapp-btn',
        '.ad-call-btn', '.ad-whatsapp-btn',
        '.nms-call-btn', '.nms-whatsapp-btn',
        '.req-svc-btn',
        '#notification-toggle-btn', '#btn-change-password',
        '.provider-only-link'
    ].join(',');
    const FEATURE_NAMES = {
        'req-svc-btn': 'طلب الخدمة والدردشة مع المزود',
        'popup-call-btn': 'الاتصال بالمعلن', 'ad-call-btn': 'الاتصال بالمعلن', 'nms-call-btn': 'الاتصال بالمعلن',
        'popup-whatsapp-btn': 'مراسلة المعلن عبر واتساب', 'ad-whatsapp-btn': 'مراسلة المعلن عبر واتساب', 'nms-whatsapp-btn': 'مراسلة المعلن عبر واتساب'
    };

    function hasSession() {
        for (const key of ['map_user', 'user']) {
            for (const store of [localStorage, sessionStorage]) {
                try { const u = JSON.parse(store.getItem(key)); if (u && (u.token || u.admin_token)) return true; } catch (e) { /* تجاهل */ }
            }
        }
        return false;
    }

    /** الزائر = لا توجد جلسة دخول صالحة محفوظة */
    window.isGuestMode = function () {
        if (window.currentAppUser && window.currentAppUser.is_guest) return true;
        return !hasSession();
    };

    // ------------------------------------------------------------ login modal
    function ensureModal() {
        let modal = document.getElementById('guest-login-modal');
        if (modal) return modal;
        modal = document.createElement('div');
        modal.id = 'guest-login-modal';
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-modal', 'true');
        modal.style.cssText = 'position:fixed; inset:0; background:rgba(15,23,42,.6); z-index:100001; display:none; align-items:center; justify-content:center; padding:16px; direction:rtl;';
        modal.innerHTML = `
            <div style="background:#fff; border-radius:16px; max-width:420px; width:100%; padding:24px; text-align:center; box-shadow:0 20px 60px rgba(0,0,0,.3); font-family:inherit;">
                <div style="font-size:42px; margin-bottom:6px;">🔒</div>
                <h3 style="margin:0 0 8px; color:#1f2937;">هذه الميزة تتطلب تسجيل الدخول</h3>
                <p id="guest-login-feature" style="margin:0 0 14px; color:#4b5563; font-size:14px;"></p>
                <ul style="text-align:right; color:#374151; font-size:13px; line-height:1.9; margin:0 0 16px; padding-right:18px;">
                    <li>عرض أرقام التواصل والاتصال والواتساب مع المعلنين</li>
                    <li>طلب الخدمة والدردشة مع المزود</li>
                    <li>تقييم الخدمات والعقارات</li>
                    <li>الإشعارات وإضافة خدماتك وعقاراتك (للمزودين)</li>
                </ul>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    <button type="button" data-guest-go="login" style="background:#27ae60; color:#fff; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:15px;">تسجيل الدخول</button>
                    <button type="button" data-guest-go="register" style="background:#1a73e8; color:#fff; border:none; padding:12px; border-radius:10px; font-weight:bold; cursor:pointer; font-size:15px;">إنشاء حساب مجاني</button>
                    <button type="button" data-guest-go="close" style="background:#f3f4f6; color:#374151; border:none; padding:10px; border-radius:10px; cursor:pointer;">متابعة التصفح كزائر</button>
                </div>
            </div>`;
        document.body.appendChild(modal);
        modal.addEventListener('click', (e) => {
            const go = e.target.closest('[data-guest-go]');
            if (e.target === modal || (go && go.dataset.guestGo === 'close')) { modal.style.display = 'none'; return; }
            if (go) window.goToLogin(go.dataset.guestGo);
        });
        return modal;
    }

    window.showLoginRequired = function (featureName) {
        const modal = ensureModal();
        modal.querySelector('#guest-login-feature').textContent = featureName ? `«${featureName}» متاحة للمستخدمين المسجلين فقط.` : '';
        modal.style.display = 'flex';
    };

    /** يرجع true إذا كان المستخدم مسجلاً، وإلا يعرض نافذة الدخول ويرجع false */
    window.requireLogin = function (featureName) {
        if (!window.isGuestMode()) return true;
        window.showLoginRequired(featureName);
        return false;
    };

    /** الانتقال لشاشة الدخول/التسجيل بالصفحة الرئيسية */
    window.goToLogin = function (mode) {
        try { sessionStorage.removeItem(GUEST_FLAG); } catch (e) { /* تجاهل */ }
        const target = mode === 'register' ? 'register' : 'login';
        const onMain = !!document.getElementById('promo-splash-overlay') || !!document.getElementById('auth-splash-overlay');
        if (onMain) window.location.href = `/?auth=${target}`;
        else window.location.href = `/?auth=${target}`;
    };

    // اعتراض الأزرار المقيّدة للزائر (مرحلة الالتقاط حتى تسبق أي معالج آخر،
    // ومنها بوب أب الخريطة الذي يوقف انتشار النقرات)
    document.addEventListener('click', (e) => {
        const target = e.target.closest(LOGIN_REQUIRED_SELECTORS);
        if (!target || !window.isGuestMode()) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        const cls = Array.from(target.classList).find(c => FEATURE_NAMES[c]);
        window.showLoginRequired(target.dataset.requiresLogin || (cls && FEATURE_NAMES[cls]) || 'هذه الميزة');
    }, true);

    // ------------------------------------------------------------ guest entry
    function hideOverlay(id) {
        const el = document.getElementById(id);
        if (!el) return;
        el.style.display = 'none';
        el.style.visibility = 'hidden';
    }

    function applyGuestUi() {
        const guest = window.isGuestMode();
        document.querySelectorAll('.guest-only').forEach(el => { el.style.setProperty('display', guest ? 'inline-flex' : 'none', 'important'); });
        let role = null;
        try { role = (JSON.parse(localStorage.getItem('map_user')) || {}).role; } catch (e) { /* تجاهل */ }
        const isProvider = !guest && (role === 'provider' || role === 'admin');
        document.querySelectorAll('.provider-only-link').forEach(el => { el.style.setProperty('display', isProvider ? 'inline-flex' : 'none', 'important'); });
        if (guest) {
            ['btn-change-password', 'btn-logout-platform', 'notification-toggle-btn', 'dashboard-btn'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.setProperty('display', 'none', 'important');
            });
            const name = document.getElementById('top-username-display');
            const roleEl = document.getElementById('top-userrole-display');
            if (name) name.textContent = 'زائر';
            if (roleEl) { roleEl.textContent = 'تصفح محدود'; roleEl.className = 'user-badge-role role-user'; }
        }
    }
    window.applyGuestUi = applyGuestUi;

    window.enterPlatformAsGuest = function () {
        if (hasSession()) return; // لديه جلسة حقيقية: لا داعي لوضع الزائر
        try { sessionStorage.setItem(GUEST_FLAG, '1'); } catch (e) { /* تجاهل */ }
        window.currentAppUser = { role: 'guest', is_guest: true, full_name: 'زائر' };
        hideOverlay('promo-splash-overlay');
        hideOverlay('auth-splash-overlay');
        window.__platformEntered = true;
        const shell = document.getElementById('app-shell');
        if (shell) shell.style.display = 'block';
        if (typeof window.initMapPlatform === 'function' && !window.__mapPlatformInitialized) {
            window.__mapPlatformInitialized = true;
            window.initMapPlatform();
        }
        if (typeof hideAllEditPanelsAndButtonsGlobally === 'function') hideAllEditPanelsAndButtonsGlobally();
        const badge = document.getElementById('user-top-badge-container');
        if (badge) { badge.classList.remove('hidden'); badge.style.setProperty('display', 'flex', 'important'); }
        applyGuestUi();
        document.dispatchEvent(new CustomEvent('guestEntered'));
    };

    function boot() {
        // أزرار "تصفح كزائر"
        document.querySelectorAll('#promo-btn-guest, [data-enter-guest]').forEach(btn => btn.addEventListener('click', window.enterPlatformAsGuest));
        document.querySelectorAll('#btn-guest-login').forEach(btn => btn.addEventListener('click', () => window.goToLogin('login')));

        const params = new URLSearchParams(window.location.search);
        const authMode = params.get('auth');
        if (authMode && !hasSession()) {
            try { sessionStorage.removeItem(GUEST_FLAG); } catch (e) { /* تجاهل */ }
            // فتح شاشة الدخول/التسجيل مباشرة (قادم من نافذة "تتطلب تسجيل الدخول")
            setTimeout(() => {
                const btn = document.getElementById(authMode === 'register' ? 'promo-btn-register' : 'promo-btn-login');
                if (btn) btn.click();
            }, 300);
        } else if (!hasSession() && document.getElementById('promo-splash-overlay')) {
            let wasGuest = false;
            try { wasGuest = sessionStorage.getItem(GUEST_FLAG) === '1'; } catch (e) { /* تجاهل */ }
            // استمرار وضع الزائر بعد تحديث الصفحة، أو فتح رابط موقع مشترك (?x=&y=) مباشرة
            if (wasGuest || (params.get('x') && params.get('y'))) setTimeout(window.enterPlatformAsGuest, 50);
        }
        applyGuestUi();
    }

    document.addEventListener('userLoggedIn', () => {
        try { sessionStorage.removeItem(GUEST_FLAG); } catch (e) { /* تجاهل */ }
        setTimeout(applyGuestUi, 0);
    });

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
