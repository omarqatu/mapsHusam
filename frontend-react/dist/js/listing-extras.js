/**
 * js/listing-extras.js
 * كتلة "التقييمات + الصور" الموحّدة للعقارات والخدمات (بوب أب الخريطة وبطاقات البحث):
 *   - متوسط التقييم وعدده وتوزيعه + التعليقات
 *   - تقييم الناشر (متوسط كل إعلاناته) مع اسمه
 *   - إضافة/تعديل تقييمك (للمستخدم المسجّل فقط؛ الزائر يُطلب منه تسجيل الدخول)
 *   - معرض الصور المرفوعة من المزود مع عارض مكبّر
 * الاستخدام: html += window.listingExtrasPlaceholder(layer, featureId)
 */
(function () {
    'use strict';
    if (window.__listingExtrasLoaded) return;
    window.__listingExtrasLoaded = true;

    const CACHE_MS = 60 * 1000;
    const cache = new Map(); // key → { at, ratings, images }
    const NO_RATING_LAYERS = ['road_barriers', 'fuel_stations'];
    const ALIASES = {
        rent: 'ApartRent', rentlayer: 'ApartRent', apartrent: 'ApartRent', 'شقق الإيجار': 'ApartRent',
        sale: 'ApartSale', salelayer: 'ApartSale', apartsale: 'ApartSale', 'شقق للبيع': 'ApartSale',
        land: 'LandSale', landlayer: 'LandSale', landsale: 'LandSale', 'الأراضي للبيع': 'LandSale'
    };
    let seq = 0;

    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }
    function normalizeLayer(layer) {
        const raw = String(layer || '').trim();
        return ALIASES[raw.toLowerCase()] || ALIASES[raw] || raw.replace(/Layer$/, '');
    }
    function stars(avg) {
        const r = Math.round(Number(avg) || 0);
        return '★'.repeat(r) + '☆'.repeat(Math.max(0, 5 - r));
    }
    function isLoggedIn() {
        if (typeof window.isGuestMode === 'function') return !window.isGuestMode();
        try { const u = JSON.parse(localStorage.getItem('map_user')); return !!(u && u.token); } catch (e) { return false; }
    }

    async function load(layer, fid, force) {
        const key = `${layer}:${fid}`;
        const hit = cache.get(key);
        if (!force && hit && Date.now() - hit.at < CACHE_MS) return hit;
        const q = `layer=${encodeURIComponent(layer)}&feature_id=${encodeURIComponent(fid)}`;
        const [ratings, images] = await Promise.all([
            fetch(`/api/listing-ratings?${q}`).then(r => (r.ok ? r.json() : null)).catch(() => null),
            fetch(`/api/listing-images?${q}`).then(r => (r.ok ? r.json() : null)).catch(() => null)
        ]);
        const entry = { at: Date.now(), ratings: ratings && ratings.success ? ratings : null, images: images && images.success ? images.images : [] };
        cache.set(key, entry);
        return entry;
    }

    function galleryHtml(images) {
        if (!images || !images.length) return '';
        const thumbs = images.slice(0, 8).map((img, i) =>
            `<button type="button" class="lx-thumb" data-lx-open="${i}" style="background-image:url('${esc(img.url)}')" aria-label="صورة ${i + 1}"></button>`).join('');
        return `<div class="lx-gallery" data-lx-images='${esc(JSON.stringify(images.map(i => i.url)))}'>${thumbs}</div>`;
    }

    function ratingsHtml(r, compact) {
        if (!r) return '<div class="lx-muted">تعذر تحميل التقييمات.</div>';
        let html = '<div class="lx-summary">';
        if (r.total > 0) {
            html += `<span class="lx-stars">${stars(r.average)}</span> <b>${r.average}</b> <span class="lx-muted">(${r.total} تقييم)</span>`;
        } else {
            html += '<span class="lx-stars lx-empty-stars">☆☆☆☆☆</span> <span class="lx-muted">لا توجد تقييمات بعد</span>';
        }
        html += '</div>';
        if (r.owner) {
            const o = r.owner;
            html += `<div class="lx-owner" title="متوسط تقييم كل إعلانات وخدمات هذا الناشر">
                <i class="fas fa-user-check"></i> تقييم الناشر <b>${esc(o.name)}</b>:
                ${o.total > 0 ? `<span class="lx-stars">${stars(o.average)}</span> <b>${o.average}</b> <span class="lx-muted">(${o.total} تقييم على ${o.listings} إعلان)</span>` : '<span class="lx-muted">لا توجد تقييمات بعد</span>'}
            </div>`;
        }
        if (compact) return html;
        html += '<div class="lx-actions">';
        if (r.total > 0) html += `<button type="button" class="lx-btn lx-btn-light" data-lx-toggle-comments>💬 التعليقات (${r.total})</button>`;
        if (r.is_owner) {
            html += '<span class="lx-muted lx-own">هذا إعلانك</span>';
        } else if (isLoggedIn() && r.can_rate) {
            html += `<button type="button" class="lx-btn" data-lx-rate>${r.my_rating ? '✏️ تعديل تقييمك' : '⭐ قيّم الآن'}</button>`;
        } else if (!isLoggedIn()) {
            html += '<button type="button" class="lx-btn" data-requires-login="تقييم الإعلانات">⭐ سجّل الدخول للتقييم</button>';
        }
        html += '</div>';
        if (r.ratings && r.ratings.length) {
            html += '<div class="lx-comments" hidden>' + r.ratings.map(c => `<div class="lx-comment">
                <div><span class="lx-stars">${stars(c.rating)}</span> <b>${esc(c.user_name)}</b>${c.verified ? ' <span class="lx-verified" title="بعد طلب خدمة مكتمل">✔ موثّق</span>' : ''}
                <span class="lx-muted">${c.created_at ? new Date(c.created_at).toLocaleDateString('ar-EG') : ''}</span></div>
                ${c.comment ? `<div class="lx-comment-text">${esc(c.comment)}</div>` : ''}</div>`).join('') + '</div>';
        }
        return html;
    }

    function rateFormHtml(mine) {
        const current = mine ? mine.rating : 0;
        const starsBtns = [1, 2, 3, 4, 5].map(n => `<button type="button" class="lx-star ${n <= current ? 'on' : ''}" data-lx-star="${n}" aria-label="${n} نجوم">★</button>`).join('');
        return `<div class="lx-rate-form">
            <div class="lx-star-row" data-value="${current}">${starsBtns}</div>
            <textarea class="lx-comment-input" maxlength="500" placeholder="تعليقك (اختياري)">${esc(mine && mine.comment ? mine.comment : '')}</textarea>
            <div class="lx-actions"><button type="button" class="lx-btn" data-lx-submit>إرسال التقييم</button>
            <button type="button" class="lx-btn lx-btn-light" data-lx-cancel>إلغاء</button></div>
        </div>`;
    }

    async function fill(el, force) {
        if (!el || !el.isConnected) return;
        const layer = el.dataset.lxLayer;
        const fid = el.dataset.lxFid;
        const compact = el.dataset.lxCompact === '1';
        try {
            const data = await load(layer, fid, force);
            if (!el.isConnected) return;
            el.__lxData = data;
            el.innerHTML = (compact ? '' : galleryHtml(data.images)) + ratingsHtml(data.ratings, compact);
        } catch (e) {
            el.innerHTML = '<div class="lx-muted">تعذر تحميل التقييمات.</div>';
        }
    }

    window.listingExtrasPlaceholder = function (layer, featureId, opts) {
        const canon = normalizeLayer(layer);
        if (!canon || featureId === undefined || featureId === null || featureId === '' || NO_RATING_LAYERS.includes(canon)) return '';
        if (typeof window.isLayerGloballyExcluded === 'function' && window.isLayerGloballyExcluded(canon)) return '';
        const id = `lx-${++seq}`;
        const compact = opts && opts.compact ? '1' : '0';
        setTimeout(() => fill(document.getElementById(id)), 0);
        return `<div class="lx" id="${id}" data-lx-layer="${esc(canon)}" data-lx-fid="${esc(featureId)}" data-lx-compact="${compact}">
            <div class="lx-muted"><span class="lx-stars">⭐</span> جاري تحميل التقييمات...</div></div>`;
    };

    window.refreshListingExtras = function (layer, featureId) {
        const canon = normalizeLayer(layer);
        cache.delete(`${canon}:${featureId}`);
        document.querySelectorAll(`.lx[data-lx-layer="${CSS.escape(canon)}"][data-lx-fid="${CSS.escape(String(featureId))}"]`).forEach(el => fill(el, true));
    };

    // ------------------------------------------------------------- lightbox
    function openLightbox(urls, index) {
        let box = document.getElementById('lx-lightbox');
        if (!box) {
            box = document.createElement('div');
            box.id = 'lx-lightbox';
            box.innerHTML = '<button type="button" class="lx-lb-close" aria-label="إغلاق">&times;</button><button type="button" class="lx-lb-prev" aria-label="السابق">&#10095;</button><img alt=""><button type="button" class="lx-lb-next" aria-label="التالي">&#10094;</button><div class="lx-lb-count"></div>';
            document.body.appendChild(box);
            box.addEventListener('click', e => {
                if (e.target === box || e.target.classList.contains('lx-lb-close')) box.classList.remove('open');
                else if (e.target.classList.contains('lx-lb-next')) show(box.__i + 1);
                else if (e.target.classList.contains('lx-lb-prev')) show(box.__i - 1);
            });
            document.addEventListener('keydown', e => {
                if (!box.classList.contains('open')) return;
                if (e.key === 'Escape') box.classList.remove('open');
                if (e.key === 'ArrowLeft') show(box.__i + 1);
                if (e.key === 'ArrowRight') show(box.__i - 1);
            });
        }
        function show(i) {
            const n = box.__urls.length;
            box.__i = (i + n) % n;
            box.querySelector('img').src = box.__urls[box.__i];
            box.querySelector('.lx-lb-count').textContent = `${box.__i + 1} / ${n}`;
        }
        box.__urls = urls;
        show(index);
        box.classList.add('open');
    }

    // --------------------------------------------------------------- events
    document.addEventListener('click', async (e) => {
        const root = e.target.closest('.lx');
        const thumb = e.target.closest('[data-lx-open]');
        if (thumb) {
            const gallery = thumb.closest('[data-lx-images]');
            try { openLightbox(JSON.parse(gallery.dataset.lxImages), Number(thumb.dataset.lxOpen)); } catch (err) { /* تجاهل */ }
            return;
        }
        if (!root) return;
        if (e.target.closest('[data-lx-toggle-comments]')) {
            const list = root.querySelector('.lx-comments');
            if (list) list.hidden = !list.hidden;
            return;
        }
        if (e.target.closest('[data-lx-rate]')) {
            const actions = root.querySelector('.lx-actions');
            if (root.querySelector('.lx-rate-form')) return;
            const mine = root.__lxData && root.__lxData.ratings ? root.__lxData.ratings.my_rating : null;
            actions.insertAdjacentHTML('afterend', rateFormHtml(mine));
            return;
        }
        const starBtn = e.target.closest('[data-lx-star]');
        if (starBtn) {
            const row = starBtn.parentElement;
            const value = Number(starBtn.dataset.lxStar);
            row.dataset.value = value;
            row.querySelectorAll('[data-lx-star]').forEach(b => b.classList.toggle('on', Number(b.dataset.lxStar) <= value));
            return;
        }
        if (e.target.closest('[data-lx-cancel]')) {
            const form = root.querySelector('.lx-rate-form');
            if (form) form.remove();
            return;
        }
        const submit = e.target.closest('[data-lx-submit]');
        if (submit) {
            const form = root.querySelector('.lx-rate-form');
            const rating = Number(form.querySelector('.lx-star-row').dataset.value);
            if (!rating) { alert('اختر عدد النجوم أولاً.'); return; }
            submit.disabled = true;
            try {
                const res = await fetch('/api/listing-ratings', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ layer: root.dataset.lxLayer, feature_id: Number(root.dataset.lxFid), rating, comment: form.querySelector('.lx-comment-input').value })
                });
                const data = await res.json().catch(() => ({}));
                if (!res.ok || !data.success) throw new Error(data.error || 'تعذر حفظ التقييم.');
                window.refreshListingExtras(root.dataset.lxLayer, root.dataset.lxFid);
                if (window.toast) window.toast('شكراً لتقييمك ⭐', 'success');
            } catch (err) {
                alert(err.message);
                submit.disabled = false;
            }
        }
    }, true); // مرحلة الالتقاط: بوب أب OpenLayers يوقف انتشار النقرات (stopEvent) قبل وصولها للـ document
})();
