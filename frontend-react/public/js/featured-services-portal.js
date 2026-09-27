/* بوابة الخدمات المميزة للخريطة */
(function () {
    'use strict';

    const API_ROOT = window.location.origin + '/';
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
            if (props[name] !== undefined && props[name] !== null && String(props[name]).trim()) return props[name];
        }
        return '';
    }

    function firstUrl(value) {
        return String(value || '').split(/[,\n|]+/).map(value => value.trim()).find(value => /^https?:\/\//i.test(value)) || '';
    }

    function mediaValue(props, type) {
        return firstValue(props, type === 'image'
            ? ['pic', 'Pic', 'PIC', 'image', 'images', 'photo', 'photos', 'img', 'picture', 'pic_url', 'image_url']
            : ['video', 'Video', 'VIDEO', 'vid', 'movie', 'video_url', 'clip', 'youtube']);
    }

    function detailsValue(props, number) {
        return firstValue(props, number === 1
            ? ['details_link_1', 'details1', 'details_1']
            : ['details_link_2', 'details2', 'details_2']);
    }

    function videoMarkup(rawUrl, className) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]+)/);
        if (yt) {
            return `<div class="featured-media-video featured-video-facade ${className || ''}" data-video-id="${escapeHtml(yt[1])}" role="button" tabindex="0" aria-label="تشغيل الفيديو" style="background-image:url('https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg');"><span><i class="fas fa-play-circle"></i></span></div>`;
        }
        if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(url)) {
            return `<video class="featured-media-video ${className || ''}" controls preload="metadata" src="${escapeHtml(url)}"></video>`;
        }
        return `<a class="featured-media-link ${className || ''}" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-play-circle"></i> مشاهدة الفيديو</a>`;
    }

    function imageMarkup(rawUrl, className) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) {
            return `<img class="featured-media-image ${className || ''}" src="${escapeHtml(url)}" alt="" loading="lazy" onerror="this.style.display='none'">`;
        }
        if (/(youtube\.com|youtu\.be|\.(mp4|webm|ogg)(\?.*)?$)/i.test(url)) {
            return videoMarkup(url, className);
        }
        return `<a class="featured-media-link ${className || ''}" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-external-link-alt"></i> فتح الرابط</a>`;
    }

    function mediaBlock(rawUrl, label) {
        const url = firstUrl(rawUrl);
        if (!url) return '';
        if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) return `<div class="featured-detail-media"><span>${escapeHtml(label)}</span>${imageMarkup(url)}</div>`;
        if (/(youtube\.com|youtu\.be|\.(mp4|webm|ogg)(\?.*)?$)/i.test(url)) return `<div class="featured-detail-media"><span>${escapeHtml(label)}</span>${videoMarkup(url)}</div>`;
        return `<a class="featured-detail-link" href="${escapeHtml(url)}" target="_blank" rel="noopener"><i class="fas fa-link"></i> ${escapeHtml(label)}</a>`;
    }

    function beforeAfterMarkup(props) {
        const before = firstUrl(detailsValue(props, 1));
        const after = firstUrl(detailsValue(props, 2));
        if (!before && !after) return '';
        const media = url => {
            if (!url) return '<div class="featured-ba-empty">لا يوجد</div>';
            if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url)) return imageMarkup(url);
            return videoMarkup(url);
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
        const name = props.name || props.title || props.location_name || 'خدمة مميزة';
        const location = props.location_name || props.location || props.village_a || '';
        const description = props.des || props.description || '';
        const status = props.auto_status !== undefined && props.auto_status !== null
            ? `<div class="featured-services-card-meta"><i class="fas fa-circle" style="color:${parseInt(props.auto_status, 10) === 0 ? '#20a05a' : '#d64545'};"></i> ${parseInt(props.auto_status, 10) === 0 ? 'متاح الآن' : 'مغلق حالياً'}${props.work_hours ? ` · ${escapeHtml(props.work_hours)}` : ''}</div>`
            : '';
        return `<div class="featured-services-card-content">
            <span class="featured-services-card-badge"><i class="fas fa-star"></i> ${escapeHtml(label)} · ${escapeHtml(layerLabel(layer))}</span>
            <h5 class="featured-services-card-title">${escapeHtml(name)}</h5>
            ${location ? `<div class="featured-services-card-meta"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(location)}</div>` : ''}
            ${status}
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
        const coordinates = getEntryCoordinates(entry);
        if (!coordinates || coordinates.length < 2) return '';
        const layer = props.discriminator || '';
        return `<button type="button" class="featured-goto-map-btn" data-provider="${escapeHtml(props.name || props.location_name || 'مزود الخدمة')}" data-layer-title="${escapeHtml(layerLabel(layer))}" data-x="${escapeHtml(coordinates[0])}" data-y="${escapeHtml(coordinates[1])}"><i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة</button>`;
    }

    function actionsMarkup(props, entry) {
        const phone = props.phone || '';
        const whatsapp = props.whatsapp || '';
        const layer = props.discriminator || '';
        const featureId = props.id ?? props.feature_id ?? props.fid ?? '';
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

        let mediaTop = pieces.video;
        let mediaRest = pieces.image + pieces.detail1 + pieces.detail2;
        if (mode === 'photo') {
            mediaTop = pieces.image;
            mediaRest = pieces.video + pieces.detail1 + pieces.detail2;
        }
        if (mode === 'video') {
            mediaTop = pieces.video;
            mediaRest = pieces.image + pieces.detail1 + pieces.detail2;
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
        const propertyLayers = ['ApartRent', 'ApartSale', 'LandSale'];
        const selected = propertyLayers.map(layer => items.find(item => item.properties?.discriminator === layer)).filter(Boolean);
        const selectedIds = new Set(selected);
        selected.push(...items.filter(item => !selectedIds.has(item)).slice(0, Math.max(0, 10 - selected.length)));
        const cards = selected.slice(0, 10).map(item => cardMarkup(item, mode, label)).filter(Boolean);
        return cards.length ? cards.join('') : '<div class="featured-services-empty">لا توجد خدمات متاحة حالياً</div>';
    }

    async function fetchRatingServices(value) {
        const targets = [
            { layer: 'service_all', workspace: 'services' },
            { layer: 'ApartRent', workspace: 'realestate' },
            { layer: 'ApartSale', workspace: 'realestate' },
            { layer: 'LandSale', workspace: 'realestate' }
        ];
        const results = await Promise.all(targets.map(async target => {
            const params = new URLSearchParams({ ...target, field_0: 'rating', operator_0: '=', value_0: String(value), conditions_count: '1' });
            try {
                const response = await fetch(`${API_ROOT}api/search-features?${params}`);
                if (!response.ok) return [];
                const data = await response.json();
                return (data.features || []).map(feature => {
                    feature.properties = { ...(feature.properties || {}) };
                    if (target.workspace === 'realestate') feature.properties.discriminator = target.layer;
                    return feature;
                });
            } catch (_) { return []; }
        }));
        return results.flat();
    }

    async function fetchUserRatedServices() {
        const response = await fetch(`${API_ROOT}api/top-rated-providers?limit=15`);
        if (!response.ok) return [];
        const data = await response.json();
        const items = (data.items || []).filter(item => item.service_layer && item.feature_id);
        const source = window.overlayLayersObj?.serviceAllLayer?.getSource?.();

        const featuresById = {};
        source?.getFeatures?.().forEach(feature => {
            const properties = feature.getProperties();
            const layer = properties.discriminator || '';
            const ids = [feature.getId(), properties.id, properties.feature_id, properties.fid];
            ids.filter(id => id !== undefined && id !== null && id !== '').forEach(id => {
                featuresById[`${layer}:${id}`] = feature;
            });
        });

        const localResults = items.map(item => {
            const feature = featuresById[`${item.service_layer}:${item.feature_id}`];
            if (!feature) return null;
            return {
                properties: feature.getProperties(),
                geometry: feature.getGeometry(),
                userRating: item.avg_rating,
                totalRatings: item.total_ratings
            };
        }).filter(Boolean);

        const localIds = new Set(localResults.map(result => `${result.properties.discriminator}:${result.properties.id ?? result.properties.feature_id ?? result.properties.fid}`));
        const missingItems = items.filter(item => !localIds.has(`${item.service_layer}:${item.feature_id}`));
        const remoteResults = await Promise.all(missingItems.map(async item => {
            const params = new URLSearchParams({
                layer: item.service_layer, workspace: ['ApartRent', 'ApartSale', 'LandSale'].includes(item.service_layer) ? 'realestate' : 'services', field_0: 'id',
                operator_0: '=', value_0: String(item.feature_id), conditions_count: '1'
            });
            try {
                let response = await fetch(`${API_ROOT}api/search-features?${params}`);
                let data = response.ok ? await response.json() : { features: [] };
                let feature = (data.features || [])[0];
                if (!feature) {
                    params.set('field_0', 'feature_id');
                    response = await fetch(`${API_ROOT}api/search-features?${params}`);
                    data = response.ok ? await response.json() : { features: [] };
                    feature = (data.features || [])[0];
                }
                if (!feature) return null;
                feature.properties = { ...feature.properties, discriminator: feature.properties?.discriminator || item.service_layer };
                return { properties: feature.properties, geometry: feature.geometry, userRating: item.avg_rating, totalRatings: item.total_ratings };
            } catch (error) {
                return null;
            }
        }));
        return [...localResults, ...remoteResults.filter(Boolean)];
    }

    function getNearbyFeaturedServices(fallbackItems = []) {
        const source = window.overlayLayersObj?.serviceAllLayer?.getSource?.();
        const center = window.map?.getView?.().getCenter?.();
        if (!source || !center || !source.getFeatures().length) {
            return fallbackItems
                .slice()
                .sort((a, b) => (parseFloat(b.properties?.rating) || 0) - (parseFloat(a.properties?.rating) || 0))
                .slice(0, 10);
        }
        const nearby = source.getFeatures()
            .filter(feature => parseFloat(feature.get('rating')) === 10 && feature.getGeometry())
            .map(feature => {
                const point = feature.getGeometry().getClosestPoint(center);
                return { feature, distance: Math.hypot(point[0] - center[0], point[1] - center[1]), rating: parseFloat(feature.get('rating')) || 0 };
            })
            .sort((a, b) => b.rating - a.rating || a.distance - b.distance)
            .map(item => ({ properties: item.feature.getProperties(), geometry: item.feature.getGeometry() }));
        const localIds = new Set(nearby.map(item => String(item.properties.id ?? item.properties.feature_id ?? item.properties.fid ?? '')));
        const fallback = fallbackItems
            .filter(item => !localIds.has(String(item.properties?.id ?? item.properties?.feature_id ?? item.properties?.fid ?? '')))
            .slice()
            .sort((a, b) => (parseFloat(b.properties?.rating) || 0) - (parseFloat(a.properties?.rating) || 0));
        return [...nearby, ...fallback].slice(0, 10);
    }

    function refreshAfterServiceLayerLoad() {
        const root = document.getElementById('featured-services-content');
        if (!root || root.dataset.loaded !== '1' || root.dataset.nearbyRefreshed === '1') return;
        root.dataset.nearbyRefreshed = '1';
        root.dataset.loaded = '0';
        loadPortal();
    }

    function sectionMarkup(title, icon, items, mode, label) {
        return `<section class="featured-services-section"><h4><i class="fas ${icon}"></i> ${title}</h4><div class="featured-services-row">${rowMarkup(items, mode, label)}</div></section>`;
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
            const nearby = getNearbyFeaturedServices(featured);

            root.innerHTML = `<p class="featured-services-intro">تضم هذه البوابة الخدمات المميزة والأكثر نشاطاً، والأعلى تقييماً، والخدمات التي تحتوي على صور وفيديوهات وروابط لعرض أعمالها قبل وبعد.</p>
                ${sectionMarkup('المميزين', 'fa-star', featured, 'featured', 'مميز')}
                ${sectionMarkup('الأعلى تقييماً', 'fa-trophy', userRated, 'featured', 'الأعلى تقييماً')}
                ${sectionMarkup('موصى بهم', 'fa-thumbs-up', recommendedItems, 'featured', 'موصى به')}
                ${sectionMarkup('خدمات قريبة من موقع الخريطة', 'fa-location-dot', nearby, 'featured', 'قريب منك')}
                ${sectionMarkup('صور', 'fa-image', withImages, 'photo', 'صور')}
                ${sectionMarkup('فيديوهات', 'fa-video', withVideos, 'video', 'فيديو')}
                ${sectionMarkup('قبل وبعد', 'fa-right-left', beforeAfter, 'beforeAfter', 'قبل وبعد')}`;
            root.dataset.userRatedCount = String(userRated.length);
            root.dataset.loaded = '1';
        } catch (error) {
            root.dataset.loaded = '0';
            root.innerHTML = '<div class="featured-services-empty">تعذر تحميل الخدمات المميزة حالياً</div>';
            console.warn('featured-services-portal:', error);
        }
    }

    function activateVideo(facade) {
        const id = facade?.dataset.videoId;
        if (!id) return;
        facade.outerHTML = `<iframe class="featured-media-video" src="https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1" title="فيديو الخدمة" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    }

    function bind() {
        const openButton = document.getElementById('open-featured-services-desktop');
        const panel = document.getElementById('featured-services-panel');
        if (openButton && panel) {
            openButton.addEventListener('click', () => {
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
            const x = Number(button.dataset.x);
            const y = Number(button.dataset.y);
            if (!Number.isFinite(x) || !Number.isFinite(y)) return;
            const title = button.dataset.layerTitle || 'خدمة';
            window.logMapEvent?.('map_click', button.dataset.provider || 'مزود الخدمة', title);
            window.map.getView().animate({ center: [x, y], zoom: 19, duration: 800 });
        });
        loadPortal();
        if (window.map?.once) {
            window.map.once('rendercomplete', () => {
                const root = document.getElementById('featured-services-content');
                if (root && root.dataset.loaded === '1' && (!getNearbyFeaturedServices().length || root.dataset.userRatedCount === '0')) {
                    root.dataset.loaded = '0';
                    loadPortal();
                }
            });
        }
        const source = window.overlayLayersObj?.serviceAllLayer?.getSource?.();
        if (source?.once) {
            source.once('featuresloadend', () => {
                const retry = () => {
                    const root = document.getElementById('featured-services-content');
                    if (!root || root.dataset.loaded !== 'loading') {
                        if (root?.dataset.loaded === '1') refreshAfterServiceLayerLoad();
                        return;
                    }
                    setTimeout(retry, 50);
                };
                retry();
            });
        }
    }

    document.addEventListener('DOMContentLoaded', bind);
    window.loadFeaturedServicesPortal = loadPortal;
})();
