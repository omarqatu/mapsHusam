/* بوابة الخدمات المميزة للخريطة */
(function () {
    'use strict';

    const API_ROOT = window.location.origin + '/';
    const isGloballyExcluded = layer => Boolean(window.isLayerGloballyExcluded?.(layer));
    const REAL_ESTATE_TARGETS = [
        { layer: 'ApartRent', label: 'شقق الإيجار' },
        { layer: 'ApartSale', label: 'شقق للبيع' },
        { layer: 'LandSale', label: 'الأراضي للبيع' }
    ].filter(item => !isGloballyExcluded(item.layer));
    const NEARBY_GROUPS = [
        { id: 'roads', title: 'حواجز الطرق', icon: 'fa-signs-post' },
        { id: 'fuel', title: 'محطات الوقود', icon: 'fa-gas-pump' },
        { id: 'realestate', title: 'العقارات', icon: 'fa-building' },
        { id: 'technicians', title: 'الفنيين والصيانة', icon: 'fa-tools' },
        { id: 'health', title: 'الصحة والرعاية', icon: 'fa-briefcase-medical' },
        { id: 'vehicles', title: 'المركبات والتوصيل', icon: 'fa-car' },
        { id: 'professional', title: 'المهن الحرة والخصوصي', icon: 'fa-user-tie' },
        { id: 'events', title: 'مناسبات وضيافة وترفيه', icon: 'fa-champagne-glasses' },
        { id: 'misc', title: 'متفرقات', icon: 'fa-ellipsis' },
        { id: 'landmarks', title: 'معالم المدينة', icon: 'fa-landmark' },
        { id: 'commercial', title: 'محلات تجارية ومطاعم', icon: 'fa-store' },
        { id: 'education', title: 'مدارس ورياض أطفال', icon: 'fa-school' },
        { id: 'jobs', title: 'وظائف شاغرة', icon: 'fa-briefcase' }
    ];
    const SERVICE_GROUP_BY_LAYER = {
        electrician: 'technicians', ac_technician: 'technicians', plumber: 'technicians',
        general_maintenance: 'technicians', painter: 'technicians', Finisher: 'technicians', carpenter: 'technicians',
        blacksmith: 'technicians', builder: 'technicians', house_cleaner: 'technicians', aluminum_tech: 'technicians',
        glass_tech: 'technicians', cctv_installer: 'technicians', gardener: 'technicians', security_firms: 'technicians',
        furniture_buyer: 'technicians', home_nurse: 'health', masseur: 'health', cupping_specialist: 'health',
        nutritionist: 'health', pharmacies_on_call: 'health', emergency_hospitals: 'health', clinics: 'health',
        doctors_on_call: 'health', ambulances_on_call: 'health', pet_care: 'health', car_mechanic: 'vehicles',
        car_electrician: 'vehicles', tire_tech: 'vehicles', car_wash: 'vehicles', motorcycle_repair: 'vehicles',
        taxi_driver: 'vehicles', delivery_services: 'vehicles', tow_truck: 'vehicles', truck_driver: 'vehicles',
        taxis_on_call: 'vehicles', car_delivery_on_call: 'vehicles', motorcycle_delivery_on_call: 'vehicles',
        bicycle_delivery_on_call: 'vehicles', lawyers: 'professional', land_surveyors: 'professional',
        real_estate_valuers: 'professional', private_tutors: 'professional', programmers: 'professional',
        music_training: 'professional', student_research_assist: 'professional', party_planner: 'events',
        zaffa_bands: 'events', music_bands: 'events', party_rental: 'events', clown_entertainer: 'events',
        martial_arts_gymnastics: 'events', public_parks_recreation: 'events', hotels: 'events',
        villas_rent: 'events', barber_shop: 'events', video_design_ads: 'events', photographers: 'events',
        online_stores: 'misc', free_distribution: 'misc', supermarket: 'commercial', commercial_shops: 'commercial',
        restaurants: 'commercial', schools_kindergartens: 'education', job_vacancies: 'jobs',
        city_landmarks: 'landmarks', fuel_stations: 'fuel', road_barriers: 'roads'
    };
    let nearbyEntries = [];
    let nearbyPosition = null;
    const mapTargets = new Map();
    let nextMapTargetId = 1;
    const SERVICE_LABELS = {
        ApartRent: 'شقق الإيجار', ApartSale: 'شقق للبيع', LandSale: 'الأراضي للبيع',
        restaurants: 'مطاعم وكوفي شوبات', photographers: 'مصور فوتوغرافي', programmers: 'مبرمجين',
        electrician: 'فني كهرباء', electricians: 'فنيين كهرباء', plumber: 'سباك (مواسيرجي)', plumbers: 'سباكون',
        ac_technician: 'فني تكييف وتبريد', general_maintenance: 'صيانة عامة', painter: 'دهان/طراشة',
        carpenter: 'نجار', blacksmith: 'حداد', builder: 'بناء ومعمار', house_cleaner: 'خدمات تنظيف',
        aluminum_tech: 'فني ألمنيوم', glass_tech: 'فني زجاج وسكريت', car_mechanic: 'ميكانيكي سيارات',
        car_electrician: 'كهربائي سيارات', tire_tech: 'بنشري / إطارات', car_wash: 'غسيل سيارات',
        motorcycle_repair: 'صيانة دراجات نارية', taxi_driver: 'مكتب تاكسي', delivery_services: 'خدمات توصيل',
        tow_truck: 'ونش إنقاذ', cctv_installer: 'فني كاميرات مراقبة', party_planner: 'منظم حفلات',
        zaffa_bands: 'فرقة زفة', music_bands: 'فرق موسيقية', party_rental: 'تأجير مستلزمات حفلات',
        home_nurse: 'تمريض منزلي', masseur: 'أخصائي مساج', cupping_specialist: 'أخصائي حجامة',
        nutritionist: 'أخصائي تغذية', truck_driver: 'سائق شاحنة', security_firms: 'شركات أمن وحراسة',
        furniture_buyer: 'شراء أثاث مستعمل', gardener: 'تنسيق حدائق', pet_care: 'رعاية حيوانات أليفة',
        clown_entertainer: 'مهرج وعروض أطفال', online_stores: 'متاجر أون لاين', villas_rent: 'فلل أجار',
        martial_arts_gymnastics: 'فنون قتالية وجمباز', public_parks_recreation: 'حدائق ومناطق ترفيهية',
        hotels: 'فنادق', free_distribution: 'توزيع أغراض مجاناً', barber_shop: 'حلاقة شباب',
        video_design_ads: 'تصميم فيديو إعلاني', pharmacies_on_call: 'صيدليات مناوبة',
        taxis_on_call: 'تكاسي نظام مناوبة', emergency_hospitals: 'طوارئ ومستشفيات', clinics: 'عيادات',
        doctors_on_call: 'دكاترة مناوبة', ambulances_on_call: 'إسعاف مناوبة', music_training: 'تدريب موسيقى ومعاهد',
        lawyers: 'محاميين', land_surveyors: 'مساحين أراضي', real_estate_valuers: 'مخمنين عقاريين',
        private_tutors: 'أساتذة خصوصي', car_delivery_on_call: 'دليفري سيارات (مناوبة)',
        motorcycle_delivery_on_call: 'دليفري دراجات (مناوبة)', bicycle_delivery_on_call: 'دليفري هوائية (مناوبة)',
        student_research_assist: 'مساعد أبحاث طلاب', supermarket: 'سوبرماركت', commercial_shops: 'محلات تجارية',
        schools_kindergartens: 'مدارس ورياض أطفال', job_vacancies: 'وظائف شاغرة', city_landmarks: 'معالم المدينة',
        road_barriers: 'حواجز الطرق', fuel_stations: 'محطات الوقود', 'Finisher': 'فني ديكور'
    };

    function layerLabel(layer) {
        return window.serviceSubtypes?.[layer]?.title || SERVICE_LABELS[layer] || layer || 'خدمات';
    }

    const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));

    function firstValue(props, names) {
        for (const name of names) {
            const value = window.getCaseInsensitiveProp ? window.getCaseInsensitiveProp(props, name) : props[name];
            if (value !== undefined && value !== null && String(value).trim()) return value;
        }
        return '';
    }

    function firstUrl(value) {
        const urls = window.parseUrlList ? window.parseUrlList(value) : String(value || '').split(/[ ,\n|]+/);
        const candidate = urls.map(item => String(item).trim()).find(Boolean) || '';
        return candidate && window.getMediaUrlForDisplay ? window.getMediaUrlForDisplay(candidate) : candidate;
    }

    function mediaValue(props, type) {
        return firstValue(props, type === 'image'
            ? ['pic', 'Pic', 'PIC', 'image', 'images', 'photo', 'photos', 'img', 'imgs', 'picture', 'pictures', 'pic_url', 'image_url', 'img_url', 'photo_url', 'picture_url']
            : ['video', 'Video', 'VIDEO', 'vid', 'movie', 'video_url', 'clip', 'youtube']);
    }

    function detailsValue(props, number) {
        return firstValue(props, number === 1
            ? ['details_link_1', 'detailsLink1', 'detailsLink_1', 'link_1', 'details_url_1', 'details1', 'details_1']
            : ['details_link_2', 'detailsLink2', 'detailsLink_2', 'link_2', 'details_url_2', 'details2', 'details_2']);
    }

    function videoMarkup(rawUrl, className) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        let yt = url.match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{6,})/i);
        if (!yt && /youtube/i.test(url)) {
            try {
                const videoId = new URL(url).searchParams.get('v');
                if (videoId) yt = [url, videoId];
            } catch (_) {}
        }
        if (yt) {
            return `<div class="featured-media-video featured-video-facade ${className || ''}" data-video-id="${escapeHtml(yt[1])}" role="button" tabindex="0" aria-label="تشغيل الفيديو" style="background-image:url('https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg');"><span><i class="fas fa-play-circle"></i></span></div>`;
        }
        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
            return `<video class="featured-media-video ${className || ''}" controls preload="metadata" src="${escapeHtml(url)}"></video>`;
        }
        return `<a class="featured-media-link ${className || ''}" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-play-circle"></i> مشاهدة الفيديو</a>`;
    }

    function isVideoUrl(url) {
        return /(youtube(?:-nocookie)?\.com|youtu\.be|\.(mp4|webm|ogg)(\?.*)?$)/i.test(String(url || ''));
    }

    function imageMarkup(rawUrl, className) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
            return `<img class="featured-media-image ${className || ''}" src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
        }
        if (isVideoUrl(url)) {
            return videoMarkup(url, className);
        }
        return `<a class="featured-media-link ${className || ''}" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> فتح الرابط</a>`;
    }

    function mediaBlock(rawUrl, label) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) return `<div class="featured-detail-media"><span>${escapeHtml(label)}</span>${imageMarkup(url)}</div>`;
        if (isVideoUrl(url)) return `<div class="featured-detail-media"><span>${escapeHtml(label)}</span>${videoMarkup(url)}</div>`;
        return `<a class="featured-detail-link" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> ${escapeHtml(label)}</a>`;
    }

    function beforeAfterMarkup(props) {
        const before = firstUrl(detailsValue(props, 1));
        const after = firstUrl(detailsValue(props, 2));
        if (!before && !after) return '';
        const media = url => {
            if (!url) return '<div class="featured-ba-empty">لا يوجد</div>';
            if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) return imageMarkup(url);
            return isVideoUrl(url) ? videoMarkup(url) : imageMarkup(url);
        };
        return `<div class="featured-before-after"><div><b>قبل</b>${media(before)}</div><div><b>بعد</b>${media(after)}</div></div>`;
    }

    function getPieces(props) {
        return {
            image: imageMarkup(mediaValue(props, 'image')),
            video: videoMarkup(mediaValue(props, 'video')),
            detail1: mediaBlock(detailsValue(props, 1), 'تفاصيل إضافية 1'),
            detail2: mediaBlock(detailsValue(props, 2), 'تفاصيل إضافية 2')
        };
    }

    function infoMarkup(props, label) {
        const layer = props.discriminator || '';
        const isRealEstate = ['ApartRent', 'ApartSale', 'LandSale'].includes(layer);
        const featureId = isRealEstate
            ? (props.fid ?? '')
            : (props.id ?? '');
        const name = props.name || props.title || props.location_name || 'خدمة مميزة';
        const location = props.location_name || props.location || props.village_a || '';
        const description = props.des || props.description || '';
        const infoRow = (icon, title, value) => value !== undefined && value !== null && String(value).trim() !== ''
            ? `<div class="featured-services-card-detail"><b>${icon} ${title}:</b> ${escapeHtml(value)}</div>` : '';
        const currency = ({ USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' })[props.currency] || '';
        const propertyDetails = isRealEstate ? [
            infoRow('💰', 'السعر', props.price !== undefined && props.price !== '' ? `${Number(props.price).toLocaleString()} ${currency}` : ''),
            infoRow('📐', 'المساحة', props.area ? `${props.area} م²` : '')
        ].join('') : '';
        const fuelDetails = layer === 'fuel_stations' && window.buildFuelAvailabilityHtml
            ? `<div class="featured-services-card-fuel">${window.buildFuelAvailabilityHtml(props)}</div>` : '';
        let barrierDetails = '';
        if (layer === 'road_barriers') {
            const stopInfo = value => window.getRoadBarrierStopInfo
                ? window.getRoadBarrierStopInfo(value)
                : { label: String(value || 'غير محدد'), color: '#6c757d', icon: '⚪' };
            const stopIn = stopInfo(window.getCaseInsensitiveProp?.(props, 'stop') ?? props.stop);
            const rawStopOut = window.getCaseInsensitiveProp?.(props, 'stop2') ?? props.stop2;
            const stopOut = rawStopOut === undefined || rawStopOut === null || String(rawStopOut).trim() === ''
                ? { label: 'غير محدد', color: '#6c757d', icon: '⚪' } : stopInfo(rawStopOut);
            barrierDetails = `<div class="featured-services-card-barrier">
                <span style="--barrier-color:${escapeHtml(stopIn.color)}"><b>للداخل:</b> ${stopIn.icon} ${escapeHtml(stopIn.label)}</span>
                <span style="--barrier-color:${escapeHtml(stopOut.color)}"><b>للخارج:</b> ${stopOut.icon} ${escapeHtml(stopOut.label)}</span>
            </div>`;
        }
        const status = props.auto_status !== undefined && props.auto_status !== null
            ? `<div class="featured-services-card-meta"><i class="fas fa-circle" style="color:${parseInt(props.auto_status, 10) === 0 ? '#20a05a' : '#d64545'};"></i> ${parseInt(props.auto_status, 10) === 0 ? 'متاح الآن' : 'مغلق حالياً'}${props.work_hours ? ` · ${escapeHtml(props.work_hours)}` : ''}</div>`
            : '';
        return `<div class="featured-services-card-content">
            <span class="featured-services-card-badge"><i class="fas fa-star"></i> ${escapeHtml(label)} · ${escapeHtml(layerLabel(layer))}${featureId !== '' ? ` <span class="featured-services-card-id">(رقم: ${escapeHtml(featureId)})</span>` : ''}</span>
            <h5 class="featured-services-card-title">${escapeHtml(name)}</h5>
            ${location ? `<div class="featured-services-card-meta"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</div>` : ''}
            ${status}
            ${infoRow('🏘️', 'المدينة / القرية', props.village_a)}
            ${infoRow('🌍', 'المحافظة', props.gov_a)}
            ${propertyDetails}
            ${fuelDetails}
            ${barrierDetails}
            ${description ? `<div class="featured-services-card-description">${escapeHtml(description)}</div>` : ''}
        </div>`;
    }

    function getEntryCoordinates(entry) {
        const geometry = entry.geometry;
        if (!geometry) return null;
        if (typeof geometry.getType === 'function') {
            if (geometry.getType() === 'Point') return geometry.getCoordinates();
            const extent = geometry.getExtent?.();
            return extent ? [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2] : null;
        }
        if (geometry.type === 'Point' && Array.isArray(geometry.coordinates)) return geometry.coordinates;
        return null;
    }

    function mapButtonMarkup(entry, props) {
        if (!entry?.geometry) return '';
        const layer = props.discriminator || '';
        const targetId = String(nextMapTargetId++);
        mapTargets.set(targetId, entry);
        return `<button type="button" class="featured-goto-map-btn" data-target-id="${targetId}" data-provider="${escapeHtml(props.name || props.location_name || 'مزود الخدمة')}" data-layer-title="${escapeHtml(layerLabel(layer))}"><i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة</button>`;
    }

    function highlightMapEntry(entry) {
        if (!entry?.geometry || !window.map || !window.ol?.format?.GeoJSON) return false;
        let feature;
        try {
            feature = typeof entry.geometry.getClosestPoint === 'function'
                ? new window.ol.Feature({ ...(entry.properties || {}) })
                : new window.ol.format.GeoJSON().readFeature({
                    type: 'Feature', geometry: entry.geometry, properties: entry.properties || {}
                });
            if (typeof entry.geometry.getClosestPoint === 'function') feature.setGeometry(entry.geometry);
        } catch (error) {
            return false;
        }
        const highlightLayer = window.searchResultsHighlightLayer || window.overlayLayersObj?.searchResultsHighlightLayer;
        const source = highlightLayer?.getSource?.();
        if (!source) return false;
        source.clear();
        source.addFeature(feature);
        const geometry = feature.getGeometry();
        if (!geometry) return false;
        const extent = geometry.getExtent();
        const center = window.ol.extent.getCenter(extent);
        window.map.getView().fit(extent, {
            duration: 800,
            padding: [100, 100, 100, 100],
            maxZoom: 19
        });
        window.currentPopupCoordinate = center;
        return true;
    }

    function actionsMarkup(props, entry) {
        const phone = props.phone || '';
        const whatsapp = props.whatsapp || '';
        const layer = props.discriminator || '';
        const isRealEstate = ['ApartRent', 'ApartSale', 'LandSale'].includes(layer);
        const featureId = isRealEstate ? (props.fid ?? '') : (props.id ?? '');
        const isLinkedProvider = typeof window.isFeatureLinkedToProvider === 'function'
            && window.isFeatureLinkedToProvider(layer, featureId);
        const providerName = props.name || props.location_name || 'مزود الخدمة';
        const serviceName = layerLabel(layer) || 'الخدمة';

        const mapButton = mapButtonMarkup(entry, props);
        if (isLinkedProvider) {
            return `<div class="featured-services-card-actions"><button class="req-svc-btn" data-provider="${escapeHtml(providerName)}" data-service="${escapeHtml(serviceName)}" data-layer="${escapeHtml(layer)}" data-feature-id="${escapeHtml(featureId)}" data-whatsapp="${escapeHtml(whatsapp)}" data-phone="${escapeHtml(phone)}"><i class="fas fa-paper-plane"></i> طلب الخدمة</button>${mapButton}</div>`;
        }
        if (!phone && !whatsapp) return mapButton ? `<div class="featured-services-card-actions">${mapButton}</div>` : '';
        return `<div class="featured-services-card-actions">
            ${phone ? `<button type="button" class="featured-call-btn" data-provider="${escapeHtml(providerName)}" data-service="${escapeHtml(serviceName)}" data-layer="${escapeHtml(layer)}" data-feature-id="${escapeHtml(featureId)}" data-phone="${escapeHtml(phone)}"><i class="fas fa-phone"></i> اتصال</button>` : ''}
            ${whatsapp ? `<button type="button" class="featured-whatsapp" data-provider="${escapeHtml(providerName)}" data-service="${escapeHtml(serviceName)}" data-layer="${escapeHtml(layer)}" data-feature-id="${escapeHtml(featureId)}" data-whatsapp="${escapeHtml(whatsapp)}"><i class="fab fa-whatsapp"></i> واتساب</button>` : ''}
            ${mapButton}
        </div>`;
    }

    function cardMarkup(entry, mode, label) {
        const props = entry.properties || {};
        const pieces = getPieces(props);
        const hasMedia = pieces.image || pieces.video || pieces.detail1 || pieces.detail2;
        if (!hasMedia && mode !== 'featured') return '';

        const imageIsVideo = pieces.image.includes('featured-video-facade');
        let mediaTop = pieces.video || (imageIsVideo ? pieces.image : '');
        let mediaRest = (imageIsVideo ? '' : pieces.image) + pieces.detail1 + pieces.detail2;
        if (mode === 'photo') {
            mediaTop = pieces.image;
            mediaRest = pieces.video + pieces.detail1 + pieces.detail2;
        }
        if (mode === 'video') {
            mediaTop = pieces.video || (imageIsVideo ? pieces.image : '');
            mediaRest = (imageIsVideo ? '' : pieces.image) + pieces.detail1 + pieces.detail2;
        }
        if (mode === 'beforeAfter') {
            mediaTop = beforeAfterMarkup(props);
            mediaRest = pieces.image + pieces.video;
        }

        const topMediaMarkup = mediaTop ? `<div class="featured-services-card-media">${mediaTop}</div>` : '';
        return `<article class="featured-services-card">
            ${topMediaMarkup}
            ${infoMarkup(props, label)}
            <div class="featured-services-card-extra">${mediaRest}</div>
            ${actionsMarkup(props, entry)}
        </article>`;
    }

    function rowMarkup(items, mode, label) {
        items = items.filter(item => !isGloballyExcluded(item.properties?.discriminator));
        const propertyLayers = REAL_ESTATE_TARGETS.map(item => item.layer);
        const selected = propertyLayers.map(layer => items.find(item => item.properties?.discriminator === layer)).filter(Boolean);
        const selectedIds = new Set(selected);
        selected.push(...items.filter(item => !selectedIds.has(item)).slice(0, Math.max(0, 10 - selected.length)));
        const cards = selected.slice(0, 10).map(item => cardMarkup(item, mode, label)).filter(Boolean);
        return cards.join('');
    }

    async function fetchRatingServices(value) {
        const targets = [
            { layer: 'service_all', workspace: 'services' },
            ...REAL_ESTATE_TARGETS.map(item => ({ layer: item.layer, workspace: 'realestate' }))
        ];
        const results = await Promise.all(targets.map(async target => {
            const params = new URLSearchParams({ ...target, field_0: 'rating', operator_0: '=', value_0: String(value), conditions_count: '1' });
            try {
                const response = await fetch(`${API_ROOT}api/search-features?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return (data.features || []).filter(feature =>
                    !isGloballyExcluded(feature.properties?.discriminator || target.layer)
                ).map(feature => {
                    feature.properties = { ...(feature.properties || {}) };
                    if (target.workspace === 'realestate') feature.properties.discriminator = target.layer;
                    return feature;
                });
            } catch (_) { return []; }
        }));
        return results.flat();
    }

    async function fetchUserRatedServices() {
        try {
            const response = await fetch(`${API_ROOT}api/top-rated-providers?limit=15`);
            if (!response.ok) return [];
            const data = await response.json();
            const knownServices = new Set(Object.keys(window.serviceSubtypes || {}));
            const items = (data.items || []).filter(item =>
                item.service_layer && item.feature_id !== undefined && item.feature_id !== null &&
                knownServices.has(String(item.service_layer)) && !isGloballyExcluded(item.service_layer)
            );
            const grouped = new Map();
            items.forEach(item => {
                const layer = String(item.service_layer);
                if (!grouped.has(layer)) grouped.set(layer, []);
                grouped.get(layer).push(item);
            });

            // نفس مسار البحث بدون خريطة: batch per layer واستخدام id الصحيح للخدمات.
            const layerResults = await Promise.all([...grouped.entries()].map(async ([layer, layerItems]) => {
                try {
                    const result = await fetch(`${API_ROOT}api/search-features-batch`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            layer,
                            workspace: 'services',
                            ids: layerItems.map(item => item.feature_id)
                        })
                    });
                    if (!result.ok) return [];
                    const featureData = await result.json();
                    const featuresById = new Map((featureData.features || []).map(feature => [
                        String(feature.properties?.id ?? ''), feature
                    ]));
                    return layerItems.map(item => {
                        const feature = featuresById.get(String(item.feature_id));
                        if (!feature) return null;
                        const properties = { ...(feature.properties || {}), discriminator: layer };
                        return {
                            properties,
                            geometry: feature.geometry,
                            userRating: item.avg_rating,
                            totalRatings: item.total_ratings
                        };
                    }).filter(Boolean);
                } catch (_) { return []; }
            }));
            return layerResults.flat();
        } catch (error) {
            return [];
        }
    }

    function nearbyFilterMarkup() {
        const optionsByGroup = Object.fromEntries(NEARBY_GROUPS.map(group => [group.id, []]));
        Object.entries(window.serviceSubtypes || {}).forEach(([layer, info]) => {
            const groupId = SERVICE_GROUP_BY_LAYER[layer] || 'misc';
            (optionsByGroup[groupId] || (optionsByGroup[groupId] = [])).push({ layer, label: info.title });
        });
        optionsByGroup.realestate = REAL_ESTATE_TARGETS.map(item => ({ layer: item.layer, label: item.label }));

        const groups = NEARBY_GROUPS.map(group => {
            const options = optionsByGroup[group.id] || [];
            if (!options.length) return '';
            const leaves = options.map(option =>
                `<label class="featured-nearby-option" data-filter-label="${escapeHtml(option.label)}"><input type="checkbox" data-layer-filter value="${escapeHtml(option.layer)}"> ${escapeHtml(option.label)}</label>`
            ).join('');
            if (options.length === 1) {
                const option = options[0];
                return `<label class="featured-nearby-direct-option" data-filter-label="${escapeHtml(option.label)}"><input type="checkbox" data-layer-filter value="${escapeHtml(option.layer)}"><i class="fas ${group.icon}"></i> ${escapeHtml(option.label)}</label>`;
            }
            return `<details class="featured-nearby-filter-group" data-group-id="${group.id}">
                <summary><i class="fas ${group.icon}"></i> ${escapeHtml(group.title)} <span>(${options.length})</span></summary>
                <label class="featured-nearby-select-group"><input type="checkbox" data-group-master> تحديد كل الفئات في هذا القسم</label>
                <div class="featured-nearby-group-options">${leaves}</div>
            </details>`;
        }).join('');
        return `<div class="featured-nearby-controls">
            <div class="featured-nearby-location-actions">
                <button type="button" class="featured-nearby-location-btn"><i class="fas fa-location-crosshairs"></i> تحديد موقعي</button>
                ${!isGloballyExcluded('road_barriers') ? '<button type="button" class="featured-nearby-shortcut" data-preset-layer="road_barriers"><i class="fas fa-signs-post"></i> حواجز الطرق</button>' : ''}
                ${!isGloballyExcluded('fuel_stations') ? '<button type="button" class="featured-nearby-shortcut" data-preset-layer="fuel_stations"><i class="fas fa-gas-pump"></i> محطات الوقود</button>' : ''}
            </div>
            <div class="featured-nearby-status" aria-live="polite">فعّل الموقع لعرض أقرب الخدمات والعقارات.</div>
            <details class="featured-nearby-filters" hidden>
                <summary>تصفية حسب نوع الخدمة أو العقار</summary>
                <input class="featured-nearby-filter-search" type="search" placeholder="ابحث عن خدمة أو عقار" aria-label="ابحث عن نوع الخدمة أو العقار">
                <div class="featured-nearby-filter-list">${groups || '<span>لا توجد خدمات متاحة</span>'}</div>
                <div class="featured-nearby-filter-actions">
                    <button type="button" class="featured-nearby-apply">تطبيق الاختيارات</button>
                    <button type="button" class="featured-nearby-clear">عرض الكل</button>
                </div>
            </details>
        </div><div class="featured-services-row featured-nearby-results"><div class="featured-services-empty">بانتظار تحديد موقعك</div></div>`;
    }

    async function fetchNearbyCandidates() {
        const servicePromise = (async () => {
            const params = new URLSearchParams({ layer: 'service_all', workspace: 'services' });
            const response = await fetch(`${API_ROOT}api/search-features?${params}`);
            if (!response.ok) throw new Error('تعذر تحميل الخدمات القريبة');
            const data = await response.json();
            return (data.features || []).filter(item => !isGloballyExcluded(item.properties?.discriminator)).map(item => ({ properties: item.properties || {}, geometry: item.geometry }));
        })();
        const propertyPromises = REAL_ESTATE_TARGETS.map(async target => {
            try {
                const params = new URLSearchParams({ layer: target.layer, workspace: 'realestate' });
                const response = await fetch(`${API_ROOT}api/search-features?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return (data.features || []).map(item => ({
                    properties: { ...(item.properties || {}), discriminator: target.layer }, geometry: item.geometry
                }));
            } catch (_) { return []; }
        });
        const [services, ...properties] = await Promise.all([servicePromise, ...propertyPromises]);
        return [...services, ...properties.flat()];
    }

    function distanceFromPosition(entry, position) {
        if (!entry.geometry || !window.ol?.format?.GeoJSON || !window.ol?.proj) return Infinity;
        try {
            const geometry = typeof entry.geometry.getClosestPoint === 'function'
                ? entry.geometry
                : new window.ol.format.GeoJSON().readFeature({
                    type: 'Feature', geometry: entry.geometry, properties: entry.properties || {}
                }).getGeometry();
            if (!geometry) return Infinity;
            entry.geometry = geometry;
            const point = geometry.getClosestPoint(position.projected);
            return Math.hypot(point[0] - position.projected[0], point[1] - position.projected[1]);
        } catch (_) { return Infinity; }
    }

    function renderNearbyResults(selectedLayers = []) {
        const root = document.getElementById('featured-services-content');
        const resultRoot = root?.querySelector('.featured-nearby-results');
        if (!resultRoot || !nearbyPosition) return;
        const filtered = selectedLayers.length
            ? nearbyEntries.filter(item => selectedLayers.includes(String(item.properties?.discriminator || '')))
            : nearbyEntries;
        const nearest = filtered.map(item => ({ item, distance: distanceFromPosition(item, nearbyPosition) }))
            .filter(row => Number.isFinite(row.distance))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 10)
            .map(row => row.item);
        resultRoot.innerHTML = nearest.length
            ? nearest.map(item => cardMarkup(item, 'featured', 'قريب منك')).join('')
            : '<div class="featured-services-empty">لا توجد نتائج قريبة للأنواع المختارة</div>';
        const status = root.querySelector('.featured-nearby-status');
        if (status) status.textContent = selectedLayers.length
            ? `أقرب ${nearest.length} نتيجة للأنواع المختارة، مرتبة حسب المسافة من موقعك.`
            : `أقرب ${nearest.length} نتيجة من جميع الأنواع، مرتبة حسب المسافة من موقعك.`;
    }

    function selectNearbyLayerOnly(layer) {
        const root = document.getElementById('featured-services-content');
        if (!root) return;
        root.querySelectorAll('.featured-nearby-filter-list [data-layer-filter]').forEach(input => {
            input.checked = input.value === layer;
        });
        root.querySelectorAll('.featured-nearby-filter-group').forEach(group => {
            const options = [...group.querySelectorAll('[data-layer-filter]')];
            const selectedCount = options.filter(input => input.checked).length;
            const master = group.querySelector('[data-group-master]');
            if (master) {
                master.checked = selectedCount === options.length;
                master.indeterminate = selectedCount > 0 && selectedCount < options.length;
            }
        });
        const selectedInput = [...root.querySelectorAll('[data-layer-filter]')].find(input => input.value === layer);
        selectedInput?.closest('.featured-nearby-filter-group')?.setAttribute('open', '');
        renderNearbyResults([layer]);
    }

    async function requestNearbyLocation(button, presetLayer = null) {
        const root = document.getElementById('featured-services-content');
        const status = root?.querySelector('.featured-nearby-status');
        const filters = root?.querySelector('.featured-nearby-filters');
        const selectedBeforeLocation = [...(root?.querySelectorAll('.featured-nearby-filter-list [data-layer-filter]:checked') || [])]
            .map(input => input.value);
        if (typeof window.requestGeolocationPosition !== 'function') {
            if (status) status.textContent = 'خدمة تحديد الموقع غير متاحة حالياً.';
            return;
        }
        button.disabled = true;
        if (status) status.textContent = 'جارٍ تحديد نقطة موقعك...';
        window.requestGeolocationPosition(async position => {
            try {
                // نفس تحويل البحث المكاني في location-search.js وإسقاط الخريطة EPSG:28191.
                const coordinates = window.ol.proj.fromLonLat(
                    [position.coords.longitude, position.coords.latitude], 'EPSG:28191'
                );
                nearbyPosition = { projected: coordinates };
                const markerSource = window.overlayLayersObj?.searchMarkerLayer?.getSource?.();
                markerSource?.clear();
                markerSource?.addFeature(new window.ol.Feature(new window.ol.geom.Point(coordinates)));
                window.map?.getView?.().animate({ center: coordinates, zoom: 18, duration: 800 });
                if (status) status.textContent = 'تم تحديد نقطة موقعك، جارٍ تحميل الخدمات والعقارات الأقرب...';
                nearbyEntries = await fetchNearbyCandidates();
                if (filters) filters.hidden = false;
                if (presetLayer) selectNearbyLayerOnly(presetLayer);
                else renderNearbyResults(selectedBeforeLocation);
            } catch (error) {
                if (status) status.textContent = error.message || 'تعذر تحميل النتائج القريبة.';
            } finally { button.disabled = false; }
        }, error => {
            if (status) status.textContent = error.message || 'تعذر تحديد موقعك. تحقق من تشغيل GPS ومنح إذن الموقع.';
            button.disabled = false;
        });
    }

    function sectionMarkup(title, icon, items, mode, label) {
        const cards = rowMarkup(items, mode, label);
        if (!cards) return '';
        return `<section class="featured-services-section"><h4><i class="fas ${icon}"></i> ${title}</h4><div class="featured-services-row">${cards}</div></section>`;
    }

    async function loadPortal() {
        const root = document.getElementById('featured-services-content');
        if (!root || root.dataset.loaded === '1' || root.dataset.loaded === 'loading') return;
        root.dataset.loaded = 'loading';
        try {
            const [featured, recommendedItems, userRated] = await Promise.all([
                fetchRatingServices(10), fetchRatingServices(9.9), fetchUserRatedServices()
            ]);
            const mediaPool = [...featured, ...recommendedItems];
            const withImages = mediaPool.filter(item => mediaValue(item.properties || {}, 'image'));
            const withVideos = mediaPool.filter(item => mediaValue(item.properties || {}, 'video'));
            const beforeAfter = mediaPool.filter(item => detailsValue(item.properties || {}, 1) && detailsValue(item.properties || {}, 2));
            root.innerHTML = `<p class="featured-services-intro">تضم هذه البوابة الخدمات المميزة والأكثر نشاطاً، والأعلى تقييماً، والخدمات التي تحتوي على صور وفيديوهات وروابط لعرض أعمالها قبل وبعد.</p>
                <section class="featured-services-section featured-nearby-section"><h4><i class="fas fa-location-dot"></i> خدمات قريبة من موقعي</h4>${nearbyFilterMarkup()}</section>
                ${sectionMarkup('المميزين', 'fa-star', featured, 'featured', 'مميز')}
                ${sectionMarkup('الأعلى تقييماً', 'fa-trophy', userRated, 'featured', 'الأعلى تقييماً')}
                ${sectionMarkup('موصى بهم', 'fa-thumbs-up', recommendedItems, 'featured', 'موصى به')}
                ${sectionMarkup('صور', 'fa-image', withImages, 'photo', 'صور')}
                ${sectionMarkup('فيديوهات', 'fa-video', withVideos, 'video', 'فيديو')}
                ${sectionMarkup('قبل وبعد', 'fa-right-left', beforeAfter, 'beforeAfter', 'قبل وبعد')}`;
            root.dataset.userRatedCount = String(userRated.length);
            root.dataset.loaded = '1';
        } catch (error) {
            root.dataset.loaded = '0';
            root.innerHTML = '<div class="featured-services-empty">تعذر تحميل الخدمات المميزة حالياً</div>';
            }
    }

    function activateVideo(facade) {
        const id = facade?.dataset.videoId;
        if (!id) return;
        facade.outerHTML = `<iframe class="featured-media-video featured-video-player" src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1" title="فيديو الخدمة" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen loading="lazy"></iframe>`;
    }

    function pinPortalToFarLeft(panel) {
        if (!panel) return;
        // فرض جهة الشاشة الفيزيائية اليسرى فوق قواعد اللوحات/التبويبات، مع إبقاء الأبعاد من CSS.
        panel.style.setProperty('left', '0px', 'important');
        panel.style.setProperty('right', 'auto', 'important');
        panel.style.setProperty('transform', 'none', 'important');
    }

    function bind() {
        const openButton = document.getElementById('open-featured-services-desktop');
        const panel = document.getElementById('featured-services-panel');
        pinPortalToFarLeft(panel);
        window.addEventListener('resize', () => pinPortalToFarLeft(panel));
        if (openButton && panel) {
            openButton.addEventListener('click', () => {
                pinPortalToFarLeft(panel);
                window.closeAllPanels?.();
                panel.classList.remove('hidden');
                loadPortal();
            });
        }
        document.getElementById('close-featured-services-panel')?.addEventListener('click', () => panel?.classList.add('hidden'));
        document.getElementById('featured-services-content')?.addEventListener('click', event => {
            const facade = event.target.closest('.featured-video-facade');
            if (facade) activateVideo(facade);
        });
        document.getElementById('featured-services-content')?.addEventListener('keydown', event => {
            if ((event.key === 'Enter' || event.key === ' ') && event.target.closest('.featured-video-facade')) activateVideo(event.target.closest('.featured-video-facade'));
        });
        document.getElementById('featured-services-content')?.addEventListener('click', event => {
            const locationButton = event.target.closest('.featured-nearby-location-btn');
            if (locationButton) {
                requestNearbyLocation(locationButton);
                return;
            }
            const presetButton = event.target.closest('.featured-nearby-shortcut');
            if (presetButton) {
                requestNearbyLocation(presetButton, presetButton.dataset.presetLayer);
                return;
            }
            if (event.target.closest('.featured-nearby-apply')) {
                const root = document.getElementById('featured-services-content');
                const selected = [...root.querySelectorAll('.featured-nearby-filter-list [data-layer-filter]:checked')].map(input => input.value);
                renderNearbyResults(selected);
                return;
            }
            if (event.target.closest('.featured-nearby-clear')) {
                const root = document.getElementById('featured-services-content');
                root.querySelectorAll('.featured-nearby-filter-list input').forEach(input => { input.checked = false; input.indeterminate = false; });
                const search = root.querySelector('.featured-nearby-filter-search');
                if (search) search.value = '';
                root.querySelectorAll('.featured-nearby-filter-list label').forEach(label => { label.hidden = false; });
                root.querySelectorAll('.featured-nearby-filter-group').forEach(group => { group.hidden = false; });
                renderNearbyResults();
                return;
            }
            const contactButton = event.target.closest('.featured-call-btn, .featured-whatsapp');
            if (contactButton) {
                const { provider, service, layer, featureId } = contactButton.dataset;
                if (contactButton.classList.contains('featured-call-btn')) {
                    window.handlePhoneCall?.(provider, contactButton.dataset.phone, service, featureId, layer);
                } else {
                    window.handleServiceRequest?.(provider, contactButton.dataset.whatsapp, service, featureId, layer);
                }
                return;
            }
            const button = event.target.closest('.featured-goto-map-btn');
            if (!button || !window.map?.getView) return;
            const entry = mapTargets.get(button.dataset.targetId);
            if (!highlightMapEntry(entry)) return;
            const title = button.dataset.layerTitle || 'خدمة';
            window.logMapEvent?.('map_click', button.dataset.provider || 'مزود الخدمة', title);
        });
        document.getElementById('featured-services-content')?.addEventListener('input', event => {
            if (!event.target.matches('.featured-nearby-filter-search')) return;
            const query = event.target.value.trim().toLocaleLowerCase();
            const root = document.getElementById('featured-services-content');
            root.querySelectorAll('.featured-nearby-filter-list label[data-filter-label]').forEach(label => {
                label.hidden = !label.dataset.filterLabel.toLocaleLowerCase().includes(query);
            });
            root.querySelectorAll('.featured-nearby-filter-group').forEach(group => {
                group.hidden = !group.querySelector('.featured-nearby-option:not([hidden])');
            });
        });
        document.getElementById('featured-services-content')?.addEventListener('change', event => {
            const root = document.getElementById('featured-services-content');
            const group = event.target.closest('.featured-nearby-filter-group');
            if (!group) return;
            const options = [...group.querySelectorAll('[data-layer-filter]')];
            if (event.target.matches('[data-group-master]')) {
                options.forEach(input => { input.checked = event.target.checked; });
            }
            const master = group.querySelector('[data-group-master]');
            if (master) {
                const selectedCount = options.filter(input => input.checked).length;
                master.checked = selectedCount === options.length;
                master.indeterminate = selectedCount > 0 && selectedCount < options.length;
            }
        });
        loadPortal();
    }

    document.addEventListener('DOMContentLoaded', bind);
    window.loadFeaturedServicesPortal = loadPortal;
})();
