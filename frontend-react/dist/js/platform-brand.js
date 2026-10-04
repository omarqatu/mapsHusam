/**
 * js/platform-brand.js
 * هوية المنصة الموحّدة (الاسم) + أزرار التواصل مع إدارة المنصة (واتساب + هاتف).
 *
 * - الاسم والأرقام تأتي من /api/platform-contact (قابلة للتعديل من صفحة إدارة
 *   النصوص بمفاتيح platform_name / platform_whatsapp / platform_phone، أو من
 *   متغيرات البيئة PLATFORM_NAME / PLATFORM_WHATSAPP / PLATFORM_PHONE).
 * - أي عنصر يحمل data-platform-name يُعبّأ باسم المنصة.
 * - عناصر data-platform-whatsapp / data-platform-phone تتحول لروابط تواصل.
 * - زر عائم للتواصل يظهر بكل الصفحات (إلا إذا كان <body data-no-contact-widget>).
 */
(function () {
    'use strict';
    if (window.__platformBrandLoaded) return;
    window.__platformBrandLoaded = true;

    const DEFAULTS = { platform_name: 'دليلك وين', platform_whatsapp: '', platform_phone: '' };
    window.PLATFORM_INFO = Object.assign({}, DEFAULTS);

    function digits(v) { return String(v || '').replace(/\D/g, ''); }
    function waNumber(v) {
        let d = digits(v);
        if (d.startsWith('00')) d = d.slice(2);
        if (d.startsWith('0') && d.length === 10) d = '970' + d.slice(1);
        return d;
    }
    function telNumber(v) { const t = String(v || '').trim(); return t.startsWith('+') ? '+' + digits(t) : digits(t); }

    window.platformWhatsappUrl = function (message) {
        const n = waNumber(window.PLATFORM_INFO.platform_whatsapp);
        if (!n) return null;
        const text = message || `مرحباً فريق ${window.PLATFORM_INFO.platform_name}، أحتاج مساعدة بخصوص المنصة.`;
        return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
    };
    window.platformPhoneUrl = function () {
        const n = telNumber(window.PLATFORM_INFO.platform_phone);
        return n ? `tel:${n}` : null;
    };

    function toggle(el, show) {
        el.hidden = !show;
        if (!show) el.style.setProperty('display', 'none');
        else if (el.style.display === 'none') el.style.removeProperty('display');
        return show;
    }

    function applyBrand(root) {
        const scope = root || document;
        const info = window.PLATFORM_INFO;
        scope.querySelectorAll('[data-platform-name]').forEach(el => { el.textContent = info.platform_name; });
        scope.querySelectorAll('[data-platform-whatsapp]').forEach(el => {
            const url = window.platformWhatsappUrl();
            if (!toggle(el, !!url)) return;
            if (el.tagName === 'A') { el.href = url; el.target = '_blank'; el.rel = 'noopener'; }
            const label = el.querySelector('[data-number]');
            if (label) label.textContent = info.platform_whatsapp;
        });
        scope.querySelectorAll('[data-platform-phone]').forEach(el => {
            const url = window.platformPhoneUrl();
            if (!toggle(el, !!url)) return;
            if (el.tagName === 'A') el.href = url;
            const label = el.querySelector('[data-number]');
            if (label) label.textContent = info.platform_phone;
        });
    }
    window.applyPlatformBrand = applyBrand;

    function buildWidget() {
        if (document.body.hasAttribute('data-no-contact-widget') || document.getElementById('platform-contact-widget')) return;
        const wa = window.platformWhatsappUrl();
        const tel = window.platformPhoneUrl();
        if (!wa && !tel) return;
        const box = document.createElement('div');
        box.id = 'platform-contact-widget';
        box.className = 'pcw';
        box.innerHTML = `
            <div class="pcw-menu" id="pcw-menu" hidden>
                <div class="pcw-title">تواصل مع إدارة <span data-platform-name></span></div>
                ${wa ? `<a class="pcw-item pcw-wa" data-platform-whatsapp target="_blank" rel="noopener"><i class="fab fa-whatsapp"></i> واتساب <span data-number dir="ltr"></span></a>` : ''}
                ${tel ? `<a class="pcw-item pcw-tel" data-platform-phone><i class="fas fa-phone"></i> اتصال <span data-number dir="ltr"></span></a>` : ''}
            </div>
            <button type="button" class="pcw-toggle" aria-expanded="false" aria-controls="pcw-menu" title="تواصل مع المنصة">
                <i class="fab fa-whatsapp"></i>
            </button>`;
        document.body.appendChild(box);
        const toggle = box.querySelector('.pcw-toggle');
        const menu = box.querySelector('.pcw-menu');
        toggle.addEventListener('click', () => {
            const open = menu.hidden;
            menu.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', e => { if (!box.contains(e.target)) { menu.hidden = true; toggle.setAttribute('aria-expanded', 'false'); } });
        box.addEventListener('click', e => {
            const link = e.target.closest('.pcw-item');
            if (link && typeof window.sendTrackingRequest === 'function') {
                window.sendTrackingRequest(window.PLATFORM_INFO.platform_name, link.classList.contains('pcw-wa') ? 'واتساب المنصة' : 'هاتف المنصة');
            }
        });
        applyBrand(box);
    }

    function load() {
        applyBrand();
        fetch('/api/platform-contact', { credentials: 'same-origin' })
            .then(r => (r.ok ? r.json() : null))
            .then(data => {
                if (data && data.success) {
                    ['platform_name', 'platform_whatsapp', 'platform_phone'].forEach(k => { if (data[k] !== undefined && data[k] !== null) window.PLATFORM_INFO[k] = String(data[k]); });
                    if (!window.PLATFORM_INFO.platform_name) window.PLATFORM_INFO.platform_name = DEFAULTS.platform_name;
                }
            })
            .catch(() => { /* نُبقي القيم الافتراضية */ })
            .finally(() => {
                applyBrand();
                buildWidget();
                document.dispatchEvent(new CustomEvent('platformInfoReady', { detail: window.PLATFORM_INFO }));
            });
    }

    // نوافذ تُبنى لاحقاً (مثل "تواصل معنا") تُعبّأ تلقائياً بالاسم والأرقام
    let pending = false;
    function watchDom() {
        if (!window.MutationObserver || !document.body) return;
        new MutationObserver(mutations => {
            if (pending) return;
            const relevant = mutations.some(m => Array.from(m.addedNodes).some(n => n.nodeType === 1 &&
                (n.matches('[data-platform-name],[data-platform-whatsapp],[data-platform-phone]') ||
                 n.querySelector('[data-platform-name],[data-platform-whatsapp],[data-platform-phone]'))));
            if (!relevant) return;
            pending = true;
            requestAnimationFrame(() => { pending = false; applyBrand(); });
        }).observe(document.body, { childList: true, subtree: true });
    }

    function start() { load(); watchDom(); }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
