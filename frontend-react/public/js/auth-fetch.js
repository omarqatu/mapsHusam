/**
 * js/auth-fetch.js
 * 🔒 يضيف تلقائياً هيدر Authorization لكل طلب fetch إلى /api/ من نفس الموقع،
 * وينهي الجلسة المحلية تلقائياً عندما يرفض السيرفر التوكن (منتهي / مُلغى / غير موجود).
 * يجب تحميله قبل أي ملف JS آخر بالصفحة.
 */
(function () {
    'use strict';
    if (window.__authFetchInstalled) return;
    window.__authFetchInstalled = true;

    const nativeFetch = window.fetch.bind(window);
    const ORIGIN = window.location.origin;
    const SESSION_KEYS = ['map_user', 'user'];
    // مسارات لا نُنهي الجلسة عند رفضها (تسجيل الدخول نفسه)
    const NO_LOGOUT_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/verify-session'];
    let expiredHandled = false;

    function readSession() {
        for (const key of SESSION_KEYS) {
            for (const store of [localStorage, sessionStorage]) {
                try {
                    const raw = store.getItem(key);
                    if (raw) return JSON.parse(raw);
                } catch (e) { /* تجاهل */ }
            }
        }
        return null;
    }

    function getToken() {
        const u = readSession();
        return u ? (u.token || u.admin_token || null) : null;
    }

    // يرجع مسار الـ API (بدون query) إذا كان الطلب لنفس الموقع، وإلا null
    function toApiPath(input) {
        const url = typeof input === 'string' ? input : ((input && input.url) || '');
        if (url.startsWith('/api/')) return url.split('?')[0];
        if (url.startsWith(ORIGIN + '/api/')) return url.substring(ORIGIN.length).split('?')[0];
        return null;
    }

    function handleExpiredSession() {
        if (expiredHandled) return;
        expiredHandled = true;
        SESSION_KEYS.forEach(function (k) {
            try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch (e) { /* تجاهل */ }
        });
        if (window.toast) window.toast('انتهت جلستك، يرجى تسجيل الدخول من جديد.', 'warning', 4000);
        setTimeout(function () { window.location.reload(); }, 1800);
    }

    // 🔄 حفظ التوكن المُجدَّد الذي يرسله السيرفر (في نفس مكان الجلسة الحالية)
    function saveRenewedToken(newToken) {
        SESSION_KEYS.forEach(function (key) {
            [localStorage, sessionStorage].forEach(function (store) {
                try {
                    const raw = store.getItem(key);
                    if (!raw) return;
                    const u = JSON.parse(raw);
                    u.token = newToken;
                    if (u.admin_token) u.admin_token = newToken;
                    store.setItem(key, JSON.stringify(u));
                } catch (e) { /* تجاهل */ }
            });
        });
    }

    window.fetch = function (input, init) {
        const apiPath = toApiPath(input);
        if (apiPath) {
            const token = getToken();
            if (token) {
                init = Object.assign({}, init || {});
                const headers = new Headers(init.headers || (typeof input !== 'string' && input.headers) || undefined);
                if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
                init.headers = headers;
            }
        }
        return nativeFetch(input, init).then(function (res) {
            // 🔄 توكن مُجدَّد من السيرفر؟ نحفظه فوراً
            if (apiPath && res.headers) {
                const renewed = res.headers.get('X-New-Token');
                if (renewed) saveRenewedToken(renewed);
            }
            // نُنهي الجلسة فقط إذا كان هناك جلسة محفوظة أصلاً (يمنع حلقة إعادة التحميل للزوار)
            if (apiPath && res.status === 401 && !NO_LOGOUT_PATHS.includes(apiPath) && readSession()) {
                res.clone().json().then(function (d) {
                    if (d && ['AUTH_REQUIRED', 'TOKEN_INVALID', 'SESSION_REVOKED'].includes(d.code)) handleExpiredSession();
                }).catch(function () { /* تجاهل */ });
            }
            return res;
        });
    };
})();