/**
 * js/my-listings.js
 * شاشتا "خدماتي" (my-services.html) و"عقاراتي" (my-properties.html) للمزود:
 * إضافة أكثر من خدمة/عقار، تعديلها، تغيير الحالة، تحديد الموقع، ورفع الصور.
 * نوع الشاشة يُحدَّد من <body data-kind="service|property">.
 */
(function () {
    'use strict';

    const KIND = document.body.dataset.kind === 'property' ? 'property' : 'service';
    const IS_PROPERTY = KIND === 'property';
    const STATUS_LABELS = { 0: 'متاح', 1: 'غير متاح', 2: 'ملغي' };
    const STATUS_CLASS = { 0: 'available', 1: 'unavailable', 2: 'cancelled' };
    const CURRENCIES = [['', '—'], ['USD', 'دولار'], ['ILS', 'شيكل'], ['JOD', 'دينار']];
    const EPSG_PS = 'EPSG:28191';

    if (typeof proj4 !== 'undefined' && !proj4.defs(EPSG_PS)) {
        proj4.defs(EPSG_PS, '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
    }

    const state = { items: [], catalog: null, filter: 'all', editing: null, map: null, marker: null, coords: null, ratings: {} };
    const $ = (sel, root = document) => root.querySelector(sel);

    function esc(v) {
        return String(v === undefined || v === null ? '' : v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    }

    function toast(msg, type = '') {
        const el = $('#ml-toast');
        el.textContent = msg;
        el.className = 'ml-toast show ' + type;
        clearTimeout(toast._t);
        toast._t = setTimeout(() => { el.className = 'ml-toast'; }, 3500);
    }

    function currentUser() {
        for (const key of ['map_user', 'user']) {
            for (const store of [localStorage, sessionStorage]) {
                try { const u = JSON.parse(store.getItem(key)); if (u && (u.token || u.admin_token)) return u; } catch (e) { /* تجاهل */ }
            }
        }
        return null;
    }

    async function api(path, options = {}) {
        const opts = Object.assign({ headers: {} }, options);
        if (opts.body && typeof opts.body !== 'string') {
            opts.body = JSON.stringify(opts.body);
            opts.headers['Content-Type'] = 'application/json';
        }
        const res = await fetch(path, opts);
        let data = {};
        try { data = await res.json(); } catch (e) { /* استجابة غير JSON */ }
        if (!res.ok || data.success === false) throw new Error(data.error || data.message || 'تعذر إكمال العملية.');
        return data;
    }

    // ------------------------------------------------------------------ gate
    function renderGate(message, showLogin) {
        $('#ml-content').innerHTML = `<div class="ml-gate"><i class="fas fa-user-lock"></i><h2>${esc(message)}</h2>
            <p style="color:#6b7280">${showLogin ? 'سجّل الدخول بحساب مزود خدمة من الصفحة الرئيسية ثم عد إلى هذه الصفحة.' : 'تواصل مع إدارة المنصة لترقية حسابك إلى مزود خدمة.'}</p>
            <a class="ml-btn ml-btn-primary" href="/">العودة للمنصة</a></div>`;
    }

    // ------------------------------------------------------------------ list
    function stars(avg) {
        const r = Math.round(avg || 0);
        return '★'.repeat(r) + '☆'.repeat(5 - r);
    }

    function statusBadge(item) {
        if (item.hidden_layer) return '<span class="ml-badge hidden-layer">التصنيف مخفي حالياً</span>';
        const s = item.expired ? 2 : item.status;
        const label = item.expired ? 'منتهي الاشتراك' : STATUS_LABELS[s];
        return `<span class="ml-badge ${STATUS_CLASS[s] || 'available'}">${esc(label)}</span>`;
    }

    function cardHtml(item) {
        const rating = state.ratings[`${item.layer}:${item.feature_id}`];
        const price = item.price !== null && item.price !== undefined ? `<span><i class="fas fa-tag"></i> ${Number(item.price).toLocaleString()} ${esc(window.currencyDisplayLabel ? window.currencyDisplayLabel(item.currency || '') : (item.currency || ''))}</span>` : '';
        const area = item.area ? `<span><i class="fas fa-ruler-combined"></i> ${esc(item.area)} م²</span>` : '';
        const hours = !IS_PROPERTY && item.work_hours ? `<span><i class="far fa-clock"></i> ${esc(item.work_hours)}</span>` : '';
        const where = item.location_name || item.village_a ? `<span><i class="fas fa-map-marker-alt"></i> ${esc(item.location_name || item.village_a)}</span>` : '';
        const ratingHtml = rating && rating.total
            ? `<span class="ml-stars">${stars(rating.average)}</span> <span>${rating.average} (${rating.total})</span>`
            : '<span>لا توجد تقييمات بعد</span>';
        const coverStyle = item.cover ? `style="background-image:url('${esc(item.cover)}')"` : '';
        const key = `${item.layer}|${item.feature_id}`;
        return `<article class="ml-card">
            <div class="ml-cover" ${coverStyle}>${item.cover ? '' : `<i class="fas ${IS_PROPERTY ? 'fa-building' : 'fa-tools'}"></i>`}
                ${statusBadge(item)}
                <span class="ml-count"><i class="far fa-images"></i> ${item.images_count || 0}</span>
            </div>
            <div class="ml-card-body">
                <h3 class="ml-card-title">${esc(item.name || 'بدون اسم')}</h3>
                <div class="ml-card-meta"><span><i class="fas fa-layer-group"></i> ${esc(item.layer_name)}</span><span>#${esc(item.feature_id)}</span>${item.is_primary ? '<span>⭐ الإعلان الأساسي</span>' : ''}</div>
                <div class="ml-card-meta">${price}${area}${hours}${where}</div>
                <div class="ml-card-meta">${ratingHtml}</div>
            </div>
            <div class="ml-card-actions">
                <button class="ml-btn ml-btn-light" data-act="edit" data-key="${esc(key)}"><i class="fas fa-pen"></i> تعديل</button>
                <button class="ml-btn ml-btn-light" data-act="images" data-key="${esc(key)}"><i class="far fa-images"></i> الصور</button>
                <button class="ml-btn ml-btn-ghost" data-act="map" data-key="${esc(key)}"><i class="fas fa-map"></i> الخريطة</button>
                <button class="ml-btn ml-btn-danger" data-act="delete" data-key="${esc(key)}" ${item.is_primary ? 'disabled title="لا يمكن حذف الإعلان الأساسي، غيّر حالته إلى ملغي"' : ''}><i class="fas fa-trash"></i> حذف</button>
            </div>
        </article>`;
    }

    function renderList() {
        const list = $('#ml-list');
        const items = state.items.filter(i => state.filter === 'all' || String(i.status) === state.filter);
        $('#ml-count').textContent = state.items.length;
        if (!state.items.length) {
            list.innerHTML = `<div class="ml-empty" style="grid-column:1/-1"><i class="fas ${IS_PROPERTY ? 'fa-house-circle-exclamation' : 'fa-toolbox'}"></i>
                لم تضف أي ${IS_PROPERTY ? 'عقار' : 'خدمة'} بعد.<br><br>
                <button class="ml-btn ml-btn-primary" data-act="add"><i class="fas fa-plus"></i> ${IS_PROPERTY ? 'أضف عقارك الأول' : 'أضف خدمتك الأولى'}</button></div>`;
            return;
        }
        list.innerHTML = items.length ? items.map(cardHtml).join('') : '<div class="ml-empty" style="grid-column:1/-1">لا توجد عناصر بهذه الحالة.</div>';
    }

    async function loadRatings() {
        if (!state.items.length) return;
        try {
            const data = await api('/api/listing-ratings/summary', { method: 'POST', body: { items: state.items.map(i => ({ layer: i.layer, feature_id: i.feature_id })) } });
            state.ratings = data.summary || {};
            renderList();
        } catch (e) { /* التقييمات اختيارية بالقائمة */ }
    }

    async function loadList() {
        $('#ml-list').innerHTML = '<div class="ml-empty" style="grid-column:1/-1"><i class="fas fa-spinner fa-spin"></i> جاري التحميل...</div>';
        try {
            const data = await api('/api/my-listings?kind=' + KIND);
            state.items = data.items || [];
            renderList();
            loadRatings();
        } catch (e) {
            $('#ml-list').innerHTML = `<div class="ml-empty" style="grid-column:1/-1">${esc(e.message)}</div>`;
        }
    }

    function findItem(key) {
        const [layer, fid] = String(key).split('|');
        return state.items.find(i => i.layer === layer && String(i.feature_id) === fid);
    }

    // ------------------------------------------------------------------ form
    function categoryOptions(selected) {
        const list = IS_PROPERTY ? state.catalog.properties : state.catalog.services;
        return list.map(c => `<option value="${esc(c.layer)}" ${c.layer === selected ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    }

    function field(name, label, value, opts = {}) {
        const type = opts.type || 'text';
        const req = opts.required ? ' <span class="req">*</span>' : '';
        const cls = opts.full ? 'ml-field full' : 'ml-field';
        const hint = opts.hint ? `<small>${esc(opts.hint)}</small>` : '';
        if (type === 'textarea') return `<div class="${cls}"><label for="f-${name}">${esc(label)}${req}</label><textarea id="f-${name}" name="${name}" maxlength="${opts.max || 2000}">${esc(value)}</textarea>${hint}</div>`;
        if (type === 'select') return `<div class="${cls}"><label for="f-${name}">${esc(label)}${req}</label><select id="f-${name}" name="${name}">${opts.options}</select>${hint}</div>`;
        return `<div class="${cls}"><label for="f-${name}">${esc(label)}${req}</label><input id="f-${name}" name="${name}" type="${type}" value="${esc(value)}" ${opts.attrs || ''}>${hint}</div>`;
    }

    function openForm(item) {
        state.editing = item || null;
        const v = item || { status: 0 };
        const statusOptions = [0, 1, 2].map(s => `<option value="${s}" ${Number(v.status) === s ? 'selected' : ''}>${STATUS_LABELS[s]}</option>`).join('');
        const currencyOptions = CURRENCIES.map(([code, label]) => `<option value="${code}" ${String(v.currency || '') === code ? 'selected' : ''}>${label}</option>`).join('');
        let html = '<form id="ml-form" class="ml-form-grid" novalidate>';
        html += field('layer', 'التصنيف', '', { type: 'select', required: true, options: categoryOptions(v.layer), hint: item ? 'لا يمكن تغيير التصنيف بعد الإضافة.' : '' });
        html += field('name', IS_PROPERTY ? 'عنوان الإعلان / اسم المعلن' : 'اسم الخدمة / مزود الخدمة', v.name, { required: true, attrs: 'maxlength="150"' });
        html += field('whatsapp', 'رقم الواتساب', v.whatsapp, { attrs: 'inputmode="tel" placeholder="0599123456"', hint: 'رقم واتساب أو هاتف واحد على الأقل مطلوب.' });
        html += field('phone', 'رقم الهاتف', v.phone, { attrs: 'inputmode="tel" placeholder="0599123456"' });
        html += field('status', 'الحالة', '', { type: 'select', options: statusOptions,
            hint: IS_PROPERTY ? 'العقار غير المتاح أو الملغي لا يظهر بالبحث.' : 'الخدمة غير المتاحة تبقى ظاهرة بالبحث مع إشارة "غير متاح"، والملغاة لا تظهر.' });
        if (IS_PROPERTY) {
            html += field('price', 'السعر', v.price, { type: 'number', attrs: 'min="0" step="any"' });
            html += field('currency', 'العملة', '', { type: 'select', options: currencyOptions });
            html += field('area', 'المساحة (م²)', v.area, { type: 'number', attrs: 'min="0" step="any"' });
        } else {
            html += field('work_hours', 'ساعات العمل', v.work_hours, { attrs: 'placeholder="08:00-17:00 أو متوفر 24 ساعة"', hint: 'خارج هذه الساعات تظهر الخدمة "مغلقة حالياً" لكنها تبقى بالبحث.' });
            html += field('price', 'السعر (اختياري)', v.price, { type: 'number', attrs: 'min="0" step="any"' });
        }
        html += field('des', 'الوصف', v.des, { type: 'textarea', full: true });
        html += field('search_tags', 'كلمات البحث', v.search_tags, { full: true, hint: 'كلمات تساعد الناس على إيجادك، مفصولة بمسافات.' });
        html += field('video', 'رابط فيديو (اختياري)', v.video, { full: true, attrs: 'placeholder="https://..."' });
        html += `<div class="ml-field full"><label>الموقع على الخريطة <span class="req">*</span></label>
            <div id="ml-map" class="ml-map"></div>
            <div class="ml-map-tools"><button type="button" class="ml-btn ml-btn-light" id="ml-gps"><i class="fas fa-location-crosshairs"></i> موقعي الحالي</button>
            <span id="ml-coords-label">انقر على الخريطة لتحديد الموقع.</span></div></div>`;
        html += '</form>';
        $('#ml-modal-title').textContent = item ? `تعديل: ${item.name || ''}` : (IS_PROPERTY ? 'إضافة عقار جديد' : 'إضافة خدمة جديدة');
        $('#ml-modal-body').innerHTML = html;
        $('#ml-modal-footer').innerHTML = `<button class="ml-btn ml-btn-primary" id="ml-save"><i class="fas fa-save"></i> حفظ</button>
            <button class="ml-btn ml-btn-ghost" data-close>إلغاء</button>`;
        if (item) $('#f-layer').disabled = true;
        openModal();
        initPickerMap(item && item.x_coord ? [item.x_coord, item.y_coord] : null);
        $('#ml-gps').onclick = useGps;
        $('#ml-save').onclick = saveForm;
    }

    function readForm() {
        const form = $('#ml-form');
        const body = {};
        ['name', 'whatsapp', 'phone', 'des', 'search_tags', 'video', 'work_hours', 'price', 'area', 'currency', 'rooms', 'status'].forEach(name => {
            const el = form.elements[name];
            if (!el) return;
            body[name] = el.value.trim();
        });
        if (body.status !== undefined) body.status = Number(body.status);
        ['price', 'area', 'rooms'].forEach(k => { if (body[k] === '') body[k] = null; });
        if (!state.editing) body.layer = form.elements.layer.value;
        if (state.coords) { body.x_coord = state.coords[0]; body.y_coord = state.coords[1]; }
        return body;
    }

    async function saveForm() {
        const body = readForm();
        if (!body.name) return toast('الاسم مطلوب.', 'error');
        if (!body.whatsapp && !body.phone) return toast('أدخل رقم واتساب أو هاتف.', 'error');
        if (!state.editing && !state.coords) return toast('حدد الموقع على الخريطة.', 'error');
        const btn = $('#ml-save');
        btn.disabled = true;
        try {
            if (state.editing) {
                await api(`/api/my-listings/${encodeURIComponent(state.editing.layer)}/${state.editing.feature_id}`, { method: 'PUT', body });
                toast('تم حفظ التعديلات ✅', 'success');
                closeModal();
            } else {
                const data = await api('/api/my-listings', { method: 'POST', body });
                toast('تمت الإضافة ✅ يمكنك الآن رفع الصور', 'success');
                await loadList();
                const created = state.items.find(i => i.layer === data.layer && Number(i.feature_id) === Number(data.feature_id));
                if (created) { openImages(created); return; }
                closeModal();
            }
            loadList();
        } catch (e) {
            toast(e.message, 'error');
        } finally {
            btn.disabled = false;
        }
    }

    // ------------------------------------------------------------- map picker
    function psToMerc(xy) { return ol.proj.fromLonLat(proj4(EPSG_PS, 'EPSG:4326', xy)); }
    function mercToPs(c) { return proj4('EPSG:4326', EPSG_PS, ol.proj.toLonLat(c)); }

    function setMarker(psCoords) {
        state.coords = [Math.round(psCoords[0] * 100) / 100, Math.round(psCoords[1] * 100) / 100];
        const merc = psToMerc(state.coords);
        state.marker.setGeometry(new ol.geom.Point(merc));
        $('#ml-coords-label').textContent = `الإحداثيات (فلسطين 1923): ${state.coords[0].toFixed(1)}, ${state.coords[1].toFixed(1)}`;
    }

    function initPickerMap(psCoords) {
        state.coords = null;
        if (typeof ol === 'undefined' || typeof proj4 === 'undefined') {
            $('#ml-map').innerHTML = '<p style="padding:20px">تعذر تحميل الخريطة.</p>';
            return;
        }
        state.marker = new ol.Feature();
        state.marker.setStyle(new ol.style.Style({ image: new ol.style.Circle({ radius: 9, fill: new ol.style.Fill({ color: '#1a73e8' }), stroke: new ol.style.Stroke({ color: '#fff', width: 3 }) }) }));
        const center = psCoords ? psToMerc(psCoords) : ol.proj.fromLonLat([35.2, 31.9]);
        state.map = new ol.Map({
            target: 'ml-map',
            layers: [
                new ol.layer.Tile({ source: new ol.source.OSM() }),
                new ol.layer.Vector({ source: new ol.source.Vector({ features: [state.marker] }) })
            ],
            view: new ol.View({ center, zoom: psCoords ? 17 : 9 })
        });
        state.map.on('singleclick', e => setMarker(mercToPs(e.coordinate)));
        if (psCoords) setMarker(psCoords);
        setTimeout(() => state.map && state.map.updateSize(), 200);
    }

    function useGps() {
        if (!navigator.geolocation) return toast('المتصفح لا يدعم تحديد الموقع.', 'error');
        toast('جاري تحديد موقعك...');
        navigator.geolocation.getCurrentPosition(pos => {
            const ps = proj4('EPSG:4326', EPSG_PS, [pos.coords.longitude, pos.coords.latitude]);
            setMarker(ps);
            state.map.getView().animate({ center: psToMerc(ps), zoom: 17 });
        }, () => toast('تعذر الوصول لموقعك، حدده يدوياً على الخريطة.', 'error'), { enableHighAccuracy: true, timeout: 15000 });
    }

    // ----------------------------------------------------------------- images
    async function compressImage(file, maxBytes) {
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('تعذر قراءة الملف.'));
            reader.readAsDataURL(file);
        });
        const img = await new Promise((resolve, reject) => {
            const i = new Image();
            i.onload = () => resolve(i);
            i.onerror = () => reject(new Error('الملف ليس صورة صالحة.'));
            i.src = dataUrl;
        });
        let maxSide = 1600;
        for (let attempt = 0; attempt < 5; attempt++) {
            const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
            const canvas = document.createElement('canvas');
            canvas.width = Math.round(img.width * scale);
            canvas.height = Math.round(img.height * scale);
            canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
            const out = canvas.toDataURL('image/jpeg', attempt < 2 ? 0.82 : 0.7);
            if ((out.length * 3) / 4 <= maxBytes) return out;
            maxSide = Math.round(maxSide * 0.75);
        }
        throw new Error('الصورة كبيرة جداً حتى بعد الضغط.');
    }

    async function openImages(item) {
        state.editing = item;
        $('#ml-modal-title').textContent = `صور: ${item.name || ''}`;
        $('#ml-modal-body').innerHTML = '<p><i class="fas fa-spinner fa-spin"></i> جاري تحميل الصور...</p>';
        $('#ml-modal-footer').innerHTML = '<button class="ml-btn ml-btn-ghost" data-close>إغلاق</button>';
        openModal();
        await renderImages(item);
    }

    async function renderImages(item) {
        try {
            const data = await api(`/api/my-listings/${encodeURIComponent(item.layer)}/${item.feature_id}`);
            const max = state.catalog.limits.maxImages;
            const tiles = data.images.map((img, idx) => `<div class="ml-image ${idx === 0 ? 'cover' : ''}" style="background-image:url('${esc(img.url)}')">
                <div class="ml-image-tools">${idx === 0 ? '<button disabled>⭐ الغلاف</button>' : `<button data-img-cover="${img.id}">جعلها غلافاً</button>`}
                <button data-img-del="${img.id}" title="حذف"><i class="fas fa-trash"></i></button></div></div>`).join('');
            const upload = data.images.length < max
                ? `<label class="ml-upload"><i class="fas fa-cloud-arrow-up"></i>رفع صور<br><small>${data.images.length}/${max}</small><input type="file" id="ml-file" accept="image/jpeg,image/png,image/webp" multiple hidden></label>`
                : '';
            $('#ml-modal-body').innerHTML = `<p style="color:#6b7280;font-size:13px;margin-top:0">الصورة الأولى هي صورة الغلاف التي تظهر بالخريطة ونتائج البحث. تُضغط الصور تلقائياً قبل الرفع.</p>
                <div class="ml-images">${tiles}${upload}</div>`;
            const input = $('#ml-file');
            if (input) input.onchange = () => uploadFiles(item, Array.from(input.files || []), max - data.images.length);
        } catch (e) {
            $('#ml-modal-body').innerHTML = `<p>${esc(e.message)}</p>`;
        }
    }

    async function uploadFiles(item, files, room) {
        if (!files.length) return;
        if (files.length > room) { toast(`يمكنك رفع ${room} صور فقط إضافية.`, 'error'); files = files.slice(0, room); }
        for (const [i, file] of files.entries()) {
            try {
                toast(`جاري رفع الصورة ${i + 1} من ${files.length}...`);
                const image = await compressImage(file, state.catalog.limits.maxImageBytes);
                await api(`/api/my-listings/${encodeURIComponent(item.layer)}/${item.feature_id}/images`, { method: 'POST', body: { image } });
            } catch (e) {
                toast(`${file.name}: ${e.message}`, 'error');
            }
        }
        toast('تم رفع الصور ✅', 'success');
        await renderImages(item);
        loadList();
    }

    // ------------------------------------------------------------------ modal
    function openModal() { $('#ml-modal').classList.add('open'); document.body.style.overflow = 'hidden'; }
    function closeModal() {
        $('#ml-modal').classList.remove('open');
        document.body.style.overflow = '';
        if (state.map) { state.map.setTarget(null); state.map = null; }
        state.editing = null;
    }

    // ----------------------------------------------------------------- events
    document.addEventListener('click', async (e) => {
        const close = e.target.closest('[data-close]');
        if (close || e.target.id === 'ml-modal') { closeModal(); return; }

        const imgCover = e.target.closest('[data-img-cover]');
        if (imgCover && state.editing) {
            const item = state.editing;
            try { await api(`/api/my-listings/images/${imgCover.dataset.imgCover}/cover`, { method: 'POST' }); await renderImages(item); loadList(); }
            catch (err) { toast(err.message, 'error'); }
            return;
        }
        const imgDel = e.target.closest('[data-img-del]');
        if (imgDel && state.editing) {
            if (!confirm('حذف هذه الصورة؟')) return;
            const item = state.editing;
            try { await api(`/api/my-listings/images/${imgDel.dataset.imgDel}`, { method: 'DELETE' }); await renderImages(item); loadList(); }
            catch (err) { toast(err.message, 'error'); }
            return;
        }

        const btn = e.target.closest('[data-act]');
        if (!btn || btn.disabled) return;
        const act = btn.dataset.act;
        if (act === 'add') {
            const list = IS_PROPERTY ? state.catalog.properties : state.catalog.services;
            if (!list.length) return toast('لا توجد تصنيفات متاحة حالياً للإضافة.', 'error');
            openForm(null);
            return;
        }
        const item = findItem(btn.dataset.key);
        if (!item) return;
        if (act === 'edit') openForm(item);
        else if (act === 'images') openImages(item);
        else if (act === 'map') {
            if (item.hidden_layer) return toast('هذا التصنيف مخفي حالياً على المنصة.', 'error');
            if (item.x_coord && item.y_coord) window.location.href = `/?x=${item.x_coord}&y=${item.y_coord}`;
        } else if (act === 'delete') {
            if (!confirm(`هل أنت متأكد من حذف "${item.name || ''}" نهائياً مع صوره وتقييماته؟`)) return;
            try { await api(`/api/my-listings/${encodeURIComponent(item.layer)}/${item.feature_id}`, { method: 'DELETE' }); toast('تم الحذف', 'success'); loadList(); }
            catch (err) { toast(err.message, 'error'); }
        }
    });

    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

    document.querySelectorAll('[data-filter]').forEach(chip => chip.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(c => c.classList.toggle('active', c === chip));
        state.filter = chip.dataset.filter;
        renderList();
    }));

    // ------------------------------------------------------------------- boot
    async function boot() {
        const user = currentUser();
        if (!user) return renderGate('يجب تسجيل الدخول أولاً', true);
        if (!['provider', 'admin'].includes(user.role)) return renderGate('هذه الصفحة مخصصة لمزودي الخدمات', false);
        $('#ml-user').textContent = user.full_name || '';
        try {
            state.catalog = await api('/api/my-listings/catalog');
            const cats = IS_PROPERTY ? state.catalog.properties : state.catalog.services;
            if (!cats.length) {
                $('#ml-notice').hidden = false;
                $('#ml-notice').textContent = IS_PROPERTY
                    ? 'كل تصنيفات العقارات مخفية حالياً من إعدادات المنصة؛ لا يمكن إضافة عقارات جديدة الآن.'
                    : 'كل تصنيفات الخدمات مخفية حالياً من إعدادات المنصة؛ لا يمكن إضافة خدمات جديدة الآن.';
            }
            loadList();
        } catch (e) {
            renderGate(e.message, false);
        }
    }
    boot();
})();
