// ==========================================
// ملف البحث الشامل المحدث بأسماء الطبقات العربية (market-search.js)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const marketSearchInput = document.getElementById('market-search-input');
    const marketSearchBtn = document.getElementById('market-search-btn');
    
    if (!marketSearchInput) {
        console.warn("Market search input not found on this page.");
        return;
    }

    let searchTimeout;

    // إعدادات المجموعات والطبقات بالأسماء الإنجليزية (كاسم فعلي للطبقة في الخريطة / WFS) مع ربطها بالأسماء العربية المباشرة
    const searchConfig = {
        'realestate': {
            workspace: 'realestate',
            layersMap: {
                'ApartRent': 'شقق الإيجار',
                'ApartSale': 'شقق للبيع',
                'LandSale': 'الأراضي للبيع'
            }
        },
        'services': {
            workspace: 'services',
            layersMap: {
                'fuel_stations': 'محطات الوقود',
                'road_barriers': 'حواجز الطرق',
                'electrician': 'فني كهرباء',
                'ac_technician': 'فني تكييف وتبريد',
                'plumber': 'سباك (مواسيرجي)',
                'general_maintenance': 'صيانة عامة',
                'painter': 'دهان/طراشة',
                'carpenter': 'نجار',
                'blacksmith': 'حداد',
                'builder': 'بناء ومعمار',
                'aluminum_tech': 'فني ألمنيوم',
                'glass_tech': 'فني زجاج وسكريت',
                'house_cleaner': 'خدمات تنظيف',
                'gardener': 'تنسيق حدائق',
                'car_mechanic': 'ميكانيكي سيارات',
                'car_electrician': 'كهربائي سيارات',
                'tire_tech': 'بنشري / إطارات',
                'car_wash': 'غسيل سيارات',
                'motorcycle_repair': 'صيانة دراجات نارية',
                'taxi_driver': 'مكتب تاكسي',
                'delivery_services': 'خدمات توصيل',
                'tow_truck': 'ونش إنقاذ',
                'truck_driver': 'سائق شاحنة',
                'party_planner': 'منظم حفلات',
                'zaffa_bands': 'فرقة زفة',
                'music_bands': 'فرق موسيقية',
                'Finisher': 'فني ديكور',
                'party_rental': 'تأجير مستلزمات حفلات',
                'clown_entertainer': 'مهرج وعروض أطفال',
                'home_nurse': 'تمريض منزلي',
                'masseur': 'أخصائي مساج',
                'cupping_specialist': 'أخصائي حجامة',
                'nutritionist': 'أخصائي تغذية',
                'pet_care': 'رعاية حيوانات أليفة',
                'cctv_installer': 'فني كاميرات مراقبة',
                'security_firms': 'شركات أمن والحراسة',
                'furniture_buyer': 'شراء أثاث مستعمل',
                'online_stores': 'متاجر أون لاين',
                'villas_rent': 'فلل أجار',
                'martial_arts_gymnastics': 'فنون قتالية وجمباز',
                'public_parks_recreation': 'حدائق ومناطق ترفيهية',
                'hotels': 'فنادق',
                'free_distribution': 'توزيع أغراض مجاناً',
                'barber_shop': 'حلاقة شباب',
                'video_design_ads': 'تصميم فيديو إعلاني',
                'pharmacies_on_call': 'صيدليات مناوبة',
                'taxis_on_call': 'تكاسي نظام مناوبة',
                'emergency_hospitals': 'طوارئ ومستشفيات',
                'clinics': 'عيادات',
                'doctors_on_call': 'دكاترة مناوبة',
                'ambulances_on_call': 'إسعاف مناوبة',
                'music_training': 'تدريب موسيقى ومعاهد',
                'lawyers': 'محاميين',
                'land_surveyors': 'مساحين أراضي',
                'real_estate_valuers': 'مخمنين عقاريين',
                'private_tutors': 'أساتذة خصوصي',
                'programmers': 'مبرمجين',
                'car_delivery_on_call': 'دليفري سيارات (مناوبة)',
                'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)',
                'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)',
                'photographers': 'مصور فوتوغرافي',
                'student_research_assist': 'مساعد أبحاث طلاب',

                'supermarket': 'سوبرماركت',
                'commercial_shops': 'محلات تجارية',
                'restaurants': 'مطاعم وكوفي شوبات',
                'schools_kindergartens': 'مدارس ورياض أطفال',
                'job_vacancies': 'وظائف شاغرة',
                'city_landmarks': 'معالم المدينة'
            }
        }
    };

    function normalizeArabic(text) {
        if (!text) return "";
        return text.toString()
            .replace(/[أإآا]/g, 'ا')
            .replace(/[ةه]/g, 'ه')
            .replace(/[ىي]/g, 'ي')
            .replace(/[ؤئء]/g, 'ء')
            .trim();
    }

    function buildFlexibleArabicCQL(word) {
        let cleanWord = word.trim();
        if (cleanWord.length === 0) return "";
        let wildcardWord = cleanWord
            .replace(/[أإآا]/g, '_')
            .replace(/[ةه]/g, '_')
            .replace(/[ىي]/g, '_')
            .replace(/[ؤئء]/g, '_');
        return `(search_tags ILIKE '%${wildcardWord}%' OR des ILIKE '%${wildcardWord}%')`;
    }

    function buildUnifiedCQLFilter(term) {
        if (!term || term.trim() === "") return "1=1";
        const words = term.split(/\s+/).filter(word => word.trim().length > 0);
        if (words.length === 0) return "1=1";
        const conditions = words.map(word => buildFlexibleArabicCQL(word)).filter(q => q !== "");
        if (conditions.length === 0) return "1=1";
        return `(${conditions.join(' AND ')})`;
    }

    function getLayerArabicTitle(groupKey, layerName) {
        const group = searchConfig[groupKey];
        if (group && group.layersMap && group.layersMap[layerName]) {
            return group.layersMap[layerName];
        }
        if (window.layerAliases && window.layerAliases[layerName]) {
            return window.layerAliases[layerName];
        }
        return layerName;
    }

    async function fetchGroupWFSForPage(groupKey, term) {
        const config = searchConfig[groupKey];
        if (!config) return [];

        const workspace = config.workspace;
        const layers = Object.keys(config.layersMap).filter(layerName => {
            if (groupKey === 'services') {
                return !((window.MAP_CONFIG?.globalExclusions || []).includes(layerName));
            }
            return true;
        });

        const unifiedFilter = buildUnifiedCQLFilter(term);
        const allFeatures = [];

        for (const layer of layers) {
            try {
                const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
                const params = new URLSearchParams({
                    layer: layer,
                    workspace: workspace,
                    field: 'search_tags',
                    operator: 'contains',
                    value: term
                });

                const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.features) {
                        const features = data.features.map(f => {
                            const layerName = f.properties.layerId || layer;
                            return {
                                ...f,
                                customTitle: getLayerArabicTitle(groupKey, layerName),
                                layerId: layerName,
                                workspace: workspace
                            };
                        });
                        allFeatures.push(...features);
                    }
                }
            } catch (err) {}
        }

        if (allFeatures.length === 0 && window.MAP_CONFIG?.server?.proxyUrl) {
            try {
                const typeNames = layers.map(l => `${workspace}:${l}`).join(',');
                const params = new URLSearchParams({
                    service: 'WFS',
                    version: '1.1.0',
                    request: 'GetFeature',
                    typeName: typeNames,
                    outputFormat: 'application/json',
                    srsname: 'EPSG:28191',
                    CQL_FILTER: unifiedFilter,
                    sortBy: 'rating D',
                    maxFeatures: '50'
                });

                const response = await fetch(`${window.MAP_CONFIG.server.proxyUrl}${workspace}/ows?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.features) {
                        const features = data.features.map(f => {
                            const layerName = f.id.split('.')[0];
                            return {
                                ...f,
                                customTitle: getLayerArabicTitle(groupKey, layerName),
                                layerId: layerName,
                                workspace: workspace
                            };
                        });
                        allFeatures.push(...features);
                    }
                }
            } catch (fallbackErr) {}
        }

        return allFeatures;
    }

    async function executeMarketGlobalSearch(term) {
        if (!term || term.trim().length < 2) return;

        const container = document.getElementById('market-results-container');
        if (container) {
            container.innerHTML = '<div style="text-align:center; padding:30px; color:#666;"><i class="fas fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">جاري البحث في كافة أقسام وعقارات الخريطة...</p></div>';
        }

        try {
            const promises = Object.keys(searchConfig).map(group => fetchGroupWFS(group, term));
            // 🆕 دمج نتائج البحث بالكلمات الدلالية الخاصة (حالة الحاجز / توفر الوقود)
            promises.push(window.fetchSpecialStatusMatches(term));
            const resultsArray = await Promise.all(promises);
            const allResults = resultsArray.flat();

            const uniqueMap = new Map();
            allResults.forEach(item => {
                const uniqueKey = item.id || JSON.stringify(item.properties);
                if (!uniqueMap.has(uniqueKey)) {
                    uniqueMap.set(uniqueKey, item);
                }
            });
            allResults = Array.from(uniqueMap.values());

            allResults.sort((a, b) => {
                const normTerm = normalizeArabic(term.trim());
                const normATitle = normalizeArabic(a.customTitle || '');
                const normBTitle = normalizeArabic(b.customTitle || '');

                const aAliasMatch = normATitle.includes(normTerm);
                const bAliasMatch = normBTitle.includes(normTerm);

                if (aAliasMatch && !bAliasMatch) return -1;
                if (!aAliasMatch && bAliasMatch) return 1;

                const aRating = parseFloat(a.properties?.rating) || 0;
                const bRating = parseFloat(b.properties?.rating) || 0;
                return bRating - aRating;
            });

            renderMarketSearchResults(allResults, term);

        } catch (error) {
            console.error('Error in market search:', error);
            if (container) {
                container.innerHTML = '<div style="text-align:center; padding:20px; color:red;">حدث خطأ أثناء البحث. يرجى المحاولة لاحقاً.</div>';
            }
        }
    }

    marketSearchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        clearTimeout(searchTimeout);
        
        if (term.trim().length < 2) {
            const container = document.getElementById('market-results-container');
            if (container) container.innerHTML = '';
            return;
        }

        searchTimeout = setTimeout(() => {
            executeMarketGlobalSearch(term.trim());
        }, 400);
    });

    function triggerManualSearch() {
        const term = marketSearchInput.value.trim();
        if (term && term.length >= 2) {
            executeMarketGlobalSearch(term);
        } else {
            alert("يرجى إدخال حرفين على الأقل للبحث.");
        }
    }

    if (marketSearchBtn) {
        marketSearchBtn.addEventListener('click', (e) => {
            e.preventDefault();
            triggerManualSearch();
        });
    }

    marketSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(searchTimeout);
            triggerManualSearch();
        }
    });
});

// دوال مساعدة مع التحقق الآمن لمنع تعارض الأسماء
if (typeof window.formatWorkHours !== 'function') {
    window.formatWorkHours = function(workHours) {
        if (!workHours || workHours.trim() === '' || workHours === '00:00-23:59') return 'دوام 24 ساعة';
        return workHours;
    };
}

if (typeof window.getStatusBadge !== 'function') {
    window.getStatusBadge = function(autoStatus, workHours) {
        const isAvailable = parseInt(autoStatus) === 0;
        const color = isAvailable ? '#28a745' : '#dc3545';
        const text = isAvailable ? 'متاح الآن' : 'مغلق حالياً';
        const icon = isAvailable ? '🟢' : '🔴';
        return `<div class="nms-status-badge" style="color:${color}; border-color:${color};">
            ${icon} ${text}
            <span class="nms-status-hours">${window.formatWorkHours(workHours)}</span>
        </div>`;
    };
}

if (typeof window.polygonCentroid !== 'function') {
    window.polygonCentroid = function(ring) {
        try {
            let x = 0, y = 0;
            ring.forEach(pt => { x += pt[0]; y += pt[1]; });
            return [x / ring.length, y / ring.length];
        } catch (e) { return null; }
    };
}

if (typeof window.getFeatureCoords !== 'function') {
    window.getFeatureCoords = function(feature) {
        const geom = feature.geometry;
        if (!geom) return null;
        if (geom.type === 'Point') return geom.coordinates;
        if (geom.type === 'Polygon') return window.polygonCentroid(geom.coordinates[0]);
        if (geom.type === 'MultiPolygon') return window.polygonCentroid(geom.coordinates[0][0]);
        return null;
    };
}

if (typeof window.sanitize !== 'function') {
    window.sanitize = function(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };
}

if (typeof window.getRealUserId !== 'function') {
    window.getRealUserId = function() {
        return typeof window.getRealUserId === 'function' ? window.getRealUserId() : 'guest';
    };
}

if (typeof window.checkRequestQuotaOrAlert !== 'function') {
    window.checkRequestQuotaOrAlert = function(userId, newTab) {
        if (typeof window.checkRequestQuotaOrAlert === 'function') {
            return window.checkRequestQuotaOrAlert(userId, newTab);
        }
        return Promise.resolve({ allowed: true });
    };
}

if (typeof window.trackRequest !== 'function') {
    window.trackRequest = function(provider, service) {
        const payload = JSON.stringify({ user_id: window.getRealUserId(), provider, service });
        const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
        const url = baseUrl + 'save-stat';
        if (navigator.sendBeacon) {
            navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
        } else {
            fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
        }
    };
}

// خريطة تحويل الأسماء الإنجليزية للطبقات (لأن market-search يستخدم الأسماء الإنجليزية)
if (typeof window.englishToArabicLayerMap !== 'object') {
    window.englishToArabicLayerMap = {
        'fuel_stations': 'محطات الوقود',
        'road_barriers': 'حواجز الطرق',
        'electrician': 'فني كهرباء',
        'ac_technician': 'فني تكييف وتبريد',
        'plumber': 'سباك (مواسيرجي)',
        'general_maintenance': 'صيانة عامة',
        'painter': 'دهان/طراشة',
        'Finisher': 'فني ديكور',
        'carpenter': 'نجار',
        'blacksmith': 'حداد',
        'builder': 'بناء ومعمار',
        'house_cleaner': 'خدمات تنظيف',
        'aluminum_tech': 'فني ألمنيوم',
        'glass_tech': 'فني زجاج وسكريت',
        'car_mechanic': 'ميكانيكي سيارات',
        'car_electrician': 'كهربائي سيارات',
        'tire_tech': 'بنشري / إطارات',
        'car_wash': 'غسيل سيارات',
        'motorcycle_repair': 'صيانة دراجات نارية',
        'taxi_driver': 'مكتب تاكسي',
        'delivery_services': 'خدمات توصيل',
        'tow_truck': 'ونش إنقاذ',
        'cctv_installer': 'فني كاميرات مراقبة',
        'party_planner': 'منظم حفلات',
        'zaffa_bands': 'فرقة زفة',
        'music_bands': 'فرق موسيقية',
        'party_rental': 'تأجير مستلزمات حفلات',
        'home_nurse': 'تمريض منزلي',
        'masseur': 'أخصائي مساج',
        'cupping_specialist': 'أخصائي حجامة',
        'nutritionist': 'أخصائي تغذية',
        'truck_driver': 'سائق شاحنة',
        'security_firms': 'شركات أمن وحراسة',
        'furniture_buyer': 'شراء أثاث مستعمل',
        'gardener': 'تنسيق حدائق',
        'pet_care': 'رعاية حيوانات أليفة',
        'clown_entertainer': 'مهرج وعروض أطفال',
        'online_stores': 'متاجر أون لاين',
        'villas_rent': 'فلل أجار',
        'martial_arts_gymnastics': 'فنون قتالية وجمباز',
        'public_parks_recreation': 'حدائق ومناطق ترفيهية',
        'hotels': 'فنادق',
        'free_distribution': 'توزيع أغراض مجاناً',
        'barber_shop': 'حلاقة شباب',
        'photographers': 'مصور فوتوغرافي',
        'video_design_ads': 'تصميم فيديو إعلاني',
        'pharmacies_on_call': 'صيدليات مناوبة',
        'taxis_on_call': 'تكاسي نظام مناوبة',
        'emergency_hospitals': 'طوارئ ومستشفيات',
        'clinics': 'عيادات',
        'doctors_on_call': 'دكاترة مناوبة',
        'ambulances_on_call': 'إسعاف مناوبة',
        'music_training': 'تدريب موسيقى ومعاهد',
        'lawyers': 'محاميين',
        'land_surveyors': 'مساحين أراضي',
        'real_estate_valuers': 'مخمنين عقاريين',
        'private_tutors': 'أساتذة خصوصي',
        'programmers': 'مبرمجين',
        'car_delivery_on_call': 'دليفري سيارات (مناوبة)',
        'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)',
        'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)',
        'student_research_assist': 'مساعد أبحاث طلاب',

        'supermarket': 'سوبرماركت',
        'commercial_shops': 'محلات تجارية',
        'restaurants': 'مطاعم وكوفي شوبات',
        'schools_kindergartens': 'مدارس ورياض أطفال',
        'job_vacancies': 'وظائف شاغرة',
        'city_landmarks': 'معالم المدينة'
    };
}

// دالة جلب التقييمات لمزود خدمة معين
window.fetchRatingsForFeature = async function(serviceLayer, featureId) {
    try {
        // في market-search، الاسم هو بالإنجليزية، نستخدمه مباشرة
        const englishLayerName = serviceLayer;
        
        const response = await fetch(`${window.location.origin}/api/service-ratings?service_layer=${englishLayerName}&feature_id=${featureId}`);
        const data = await response.json();
        
        if (data.success) {
            const ratingElement = document.getElementById(`rating-text-${serviceLayer}-${featureId}`);
            const ratingContainer = document.getElementById(`rating-display-${serviceLayer}-${featureId}`);
            
            if (ratingElement && ratingContainer) {
                if (data.totalRatings > 0) {
                    const stars = '★'.repeat(Math.round(data.averageRating)) + '☆'.repeat(5 - Math.round(data.averageRating));
                    ratingElement.innerHTML = `<span style="color: #ffc107; font-size: 14px;">${stars}</span> <span style="color: #333; font-weight: bold;">${data.averageRating}</span> <span style="color: #666;">(${data.totalRatings} تقييم)</span>`;
                    
                    // التحقق من عدم وجود زر التعليقات مسبقاً
                    let commentsButton = document.getElementById(`comments-btn-${serviceLayer}-${featureId}`);
                    if (!commentsButton) {
                        // إضافة زر لعرض التعليقات
                        const button = document.createElement('button');
                        button.id = `comments-btn-${serviceLayer}-${featureId}`;
                        button.onclick = () => window.toggleComments(serviceLayer, featureId);
                        button.style.cssText = 'margin-top: 6px; padding: 4px 8px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
                        button.innerHTML = `💬 عرض التعليقات (${data.totalRatings})`;
                        ratingContainer.appendChild(button);
                        
                        // إضافة حاوية التعليقات
                        const commentsDiv = document.createElement('div');
                        commentsDiv.id = `comments-container-${serviceLayer}-${featureId}`;
                        commentsDiv.style.cssText = 'display: none; margin-top: 8px; max-height: 180px; overflow-y: auto; border-top: 1px solid #eee; padding-top: 6px;';
                        ratingContainer.appendChild(commentsDiv);
                    }
                    
                    // تخزين التقييمات لاستخدامها عند فتح التعليقات
                    window.currentRatings = window.currentRatings || {};
                    window.currentRatings[`${serviceLayer}-${featureId}`] = data.ratings;
                } else {
                    ratingElement.innerHTML = '<span style="color: #999;">لا توجد تقييمات بعد</span>';
                }
            }
        }
    } catch (err) {
        console.warn('فشل جلب التقييمات:', err.message);
    }
};

// دالة عرض/إخفاء التعليقات
window.toggleComments = function(serviceLayer, featureId) {
    const container = document.getElementById(`comments-container-${serviceLayer}-${featureId}`);
    if (!container) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        const ratings = window.currentRatings?.[`${serviceLayer}-${featureId}`] || [];
            
        if (ratings.length === 0) {
            container.innerHTML = '<div style="color: #999; font-size: 12px;">لا توجد تعليقات</div>';
        } else {
            container.innerHTML = ratings.map(r => `
                <div style="padding: 6px; background: #f9f9f9; border-radius: 4px; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: bold; font-size: 12px; color: #333;">${r.user_name || 'مستخدم'}</span>
                        <span style="color: #ffc107; font-size: 13px;">${'★'.repeat(r.rating)}</span>
                    </div>
                    ${r.comment ? `<div style="font-size: 12px; color: #666; line-height: 1.4;">${r.comment}</div>` : ''}
                    <div style="font-size: 10px; color: #999; margin-top: 4px;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
                </div>
            `).join('');
        }
    } else {
        container.style.display = 'none';
    }
};

if (typeof window.renderMarketSearchResults !== 'function') {
    window.renderMarketSearchResults = function(features, term) {
        const container = document.getElementById('market-results-container');
        if (!container) return;

        if (!features || features.length === 0) {
            container.innerHTML = `<div class="nms-empty">لا توجد نتائج مطابقة لـ "<strong>${term}</strong>"</div>`;
            return;
        }

        container.innerHTML = '';

        // 🆕 نفس بنية وأصناف (classes) بطاقات وأزرار نتائج صفحة "البحث بدون خريطة"
        // (no-map-search.js) تماماً - بدون أي أنماط inline مضمّنة - حتى يتطابق
        // الشكل والنمط الفعلي للأزرار (اتصال / واتساب / طلب الخدمة / الانتقال
        // إلى الخريطة) في كلا الموضعين عبر نفس ملف no-map-search.css.
        features.slice(0, 50).forEach((f, index) => {
            const p = f.properties || {};
            const isRealEstate = f.workspace === 'realestate';
            const layerTitle = f.customTitle || 'عنصر مميز';
            const coords = window.getFeatureCoords(f);

            const card = document.createElement('div');
            card.className = 'nms-result-card';
            card.style.setProperty('--i', Math.min(index, 20));

            let html = '';
            html += `<div style="margin-bottom:8px;"><span style="background: #e8f0fe; color: #1a73e8; font-size: 11px; padding: 3px 8px; border-radius: 4px; font-weight: bold;">📌 ${window.sanitize(layerTitle)}</span></div>`;

            if (!isRealEstate) html += window.getStatusBadge(p.auto_status, p.work_hours);
            if (p.name) html += `<div class="nms-r-name"><i class="fas fa-user"></i> ${window.sanitize(p.name)}</div>`;
            if (p.location_name || p.location) html += `<div class="nms-r-loc"><i class="fas fa-map-marker-alt"></i> ${window.sanitize(p.location_name || p.location)}</div>`;

            // إضافة عرض النجوم للخدمات فقط
            if (!isRealEstate) {
                const layerDbName = f.layerId || '';
                const featureId = (p.id !== undefined && p.id !== null) ? p.id : '';
                if (layerDbName && featureId) {
                    html += `<div id="rating-display-${layerDbName}-${featureId}" class="nms-rating-display">
                        <span style="color: #f57c00;">⭐</span>
                        <span id="rating-text-${layerDbName}-${featureId}" style="color: #666; font-size: 12px;">جاري تحميل التقييم...</span>
                    </div>`;
                    
                    // جلب التقييم بشكل غير متزامن
                    setTimeout(() => {
                        if (typeof window.fetchRatingsForFeature === 'function') {
                            window.fetchRatingsForFeature(layerDbName, featureId);
                        }
                    }, index * 100);
                }
            }

            if (isRealEstate) {
                if (p.price) {
                    const symbols = { USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' };
                    const sym = symbols[p.currency] || '';
                    html += `<div class="nms-r-line"><b>💰 السعر:</b> ${Number(p.price).toLocaleString()} ${sym}</div>`;
                }
                if (p.area) html += `<div class="nms-r-line"><b>📐 المساحة:</b> ${p.area} م²</div>`;
                if (p.village_a) html += `<div class="nms-r-line"><b>🏘️ البلدة:</b> ${window.sanitize(p.village_a)}</div>`;
                if (p.gov_a) html += `<div class="nms-r-line"><b>🌍 المحافظة:</b> ${window.sanitize(p.gov_a)}</div>`;
            }
            if (p.des) html += `<div class="nms-r-desc"><b>📝 الوصف:</b> ${window.sanitize(p.des)}</div>`;
            if (p.pic) html += `<div class="nms-r-img"><img src="${p.pic}" onerror="this.parentElement.style.display='none'"></div>`;

            card.innerHTML = html;

            if (p.whatsapp || p.phone) {
                // 🆕 استخدام قيمة phone مباشرة إذا كانت موجودة، وإلا التحويل من whatsapp
                const localPhone = p.phone ? p.phone.toString() : ('0' + (p.whatsapp || '').toString().replace(/\D/g, '').slice(5));
                const cleanDigits = (p.whatsapp || p.phone || '').toString().replace(/\D/g, '');
                const providerName = p.name || (isRealEstate ? 'المعلن' : 'مزود الخدمة');

                const layerDbName = (f.layerId || '').replace(/Layer$/i, '');
                const featureIdForRequest = (p.id !== undefined && p.id !== null) ? p.id : '';
                const isLinkedProvider = !isRealEstate && typeof window.isFeatureLinkedToProvider === 'function' && window.isFeatureLinkedToProvider(layerDbName, featureIdForRequest);

                const actions = document.createElement('div');
                actions.className = 'nms-r-actions';

                if (isLinkedProvider) {
                    actions.innerHTML = `
                        <button class="req-svc-btn" data-provider="${providerName.replace(/"/g, '&quot;')}" data-service="${layerTitle.replace(/"/g, '&quot;')}" data-layer="${layerDbName}" data-feature-id="${featureIdForRequest}">
                            <i class="fas fa-paper-plane"></i> طلب الخدمة
                        </button>
                    `;
                } else {
                    // 🆕 زر الاتصال يظهر فقط إذا كان هناك phone
                    const hasPhone = p.phone !== undefined && p.phone !== null && p.phone !== '' && String(p.phone).trim() !== '';
                    actions.innerHTML = `
                        ${hasPhone ? `<button class="nms-call-btn"><i class="fas fa-mobile-alt"></i> اتصال</button>` : ''}
                        <button class="nms-whatsapp-btn"><i class="fab fa-whatsapp"></i> واتساب</button>
                    `;

                    if (hasPhone) {
                        actions.querySelector('.nms-call-btn').onclick = async () => {
                            const quota = await window.checkRequestQuotaOrAlert(window.getRealUserId(), null);
                            if (!quota.allowed) return;
                            window.trackRequest(providerName, `(${layerTitle}) اتصال مباشر`);
                            window.location.href = 'tel:' + localPhone;
                        };
                    }

                    actions.querySelector('.nms-whatsapp-btn').onclick = async () => {
                        const newTab = window.open('', '_blank');
                        const quota = await window.checkRequestQuotaOrAlert(window.getRealUserId(), newTab);
                        if (!quota.allowed) return;
                        window.trackRequest(providerName, `(${layerTitle}) واتساب`);
                        const message = `مرحباً ${providerName}، أرغب بالاستفسار عن (${layerTitle}) من خلال منصة الخدمات.`;
                        let cleanNumber = cleanDigits;
                        if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);
                        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;
                        if (newTab) {
                            newTab.location.href = whatsappUrl;
                        } else {
                            window.open(whatsappUrl, '_blank');
                        }
                    };
                }
                card.appendChild(actions);
            }

            if (coords) {
                const goBtn = document.createElement('button');
                goBtn.className = 'nms-goto-map-btn';
                goBtn.innerHTML = '<i class="fas fa-map-location-dot"></i> الانتقال إلى الخريطة';
                goBtn.onclick = () => {
                    window.open(`/original-index.html?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}`, '_blank');
                };
                card.appendChild(goBtn);
            }

            container.appendChild(card);
        });
    };
}