/**
 * global-search.js
 */

const layerAliases = {
    // --- العقارات ---
    'ApartRent': 'شقة للإيجار', 
    'ApartSale': 'شقة للبيع', 
    'LandSale': 'أرض للبيع',
    
    // --- الخدمات ---
    'road_barriers': 'حواجز الطرق', 'fuel_stations': 'محطات الوقود',
    'electrician': 'فني كهرباء', 'ac_technician': 'فني تكييف وتبريد', 'plumber': 'سباك (مواسيرجي)',
    'general_maintenance': 'صيانة عامة', 'painter': 'دهان/طراشة', 'Finisher': 'فني ديكور', 'carpenter': 'نجار',
    'blacksmith': 'حداد', 'builder': 'بناء ومعمار', 'aluminum_tech': 'فني ألمنيوم', 'glass_tech': 'فني زجاج وسكريت',
    'house_cleaner': 'خدمات تنظيف تعزيل', 'gardener': 'تنسيق حدائق', 'car_mechanic': 'ميكانيكي سيارات',
    'car_electrician': 'كهربائي سيارات', 'tire_tech': 'بنشري / إطارات', 'car_wash': 'غسيل سيارات',
    'motorcycle_repair': 'صيانة دراجات نارية', 'taxi_driver': 'مكتب تاكسي', 'delivery_services': 'خدمات توصيل',
    'tow_truck': 'ونش إنقاذ / سطحة', 'truck_driver': 'سائق شاحنة', 'party_planner': 'منظم حفلات',
    'zaffa_bands': 'فرق زفة أعراس', 'music_bands': 'فرق موسيقية', 
    'party_rental': 'تأجير مستلزمات حفلات', 'clown_entertainer': 'مهرج وعروض أطفال',
    'home_nurse': 'تمريض منزلي', 'masseur': 'أخصائي مساج', 'cupping_specialist': 'أخصائي حجامة',
    'nutritionist': 'أخصائي تغذية', 'pet_care': 'رعاية حيوانات أليفة', 'cctv_installer': 'فني كاميرات مراقبة',
    'security_firms': 'شركات أمن وحراسة', 'furniture_buyer': 'شراء أثاث مستعمل',

    
    'online_stores': 'متاجر أون لاين', 'villas_rent': 'فلل أجار', 
    'martial_arts_gymnastics': 'فنون قتالية وجمباز', 'public_parks_recreation': 'حدائق ومناطق ترفيهية',
    'hotels': 'فنادق', 'free_distribution': 'توزيع أغراض مجاناً', 
    'barber_shop': 'حلاقة شباب', 'photographers': 'مصور فوتوغرافي', 'video_design_ads': 'تصميم فيديو إعلاني', 
    'pharmacies_on_call': 'صيدليات مناوبة', 'taxis_on_call': 'تكاسي نظام مناوبة', 
    'emergency_hospitals': 'طوارئ ومستشفيات', 'clinics': 'عيادات', 
    'doctors_on_call': 'دكاترة مناوبة', 'ambulances_on_call': 'إسعاف مناوبة', 
    'music_training': 'تدريب موسيقى ومعاهد', 'lawyers': 'محاميين', 
    'land_surveyors': 'مساحين أراضي', 'real_estate_valuers': 'مخمنين عقاريين', 
    'private_tutors': 'أساتذة خصوصي', 'programmers': 'مبرمجين', 
    'car_delivery_on_call': 'دليفري سيارات (مناوبة)', 'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)', 
    'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)',  
    'student_research_assist': 'مساعد أبحاث طلاب',
    'supermarket': 'سوبرماركت', 'commercial_shops': 'محلات تجارية',
    'restaurants': 'مطاعم', 'schools_kindergartens': 'مدارس ورياض أطفال',
    'job_vacancies': 'وظائف شاغرة', 'city_landmarks': 'معالم المدينة'
    
};

const searchConfig = {
    'realestate': {
        workspace: 'realestate',
        // 🆕 استبعاد الطبقات المضافة إلى globalExclusions بـ config.js (يفهم
        // 'ApartRent' أو 'rentLayer' أو 'rent' - أي صيغة مكتوبة هناك)
        layers: ['ApartRent', 'ApartSale', 'LandSale'].filter(layerName => !window.isLayerGloballyExcluded(layerName))
    },
    'services': {
        workspace: 'services',
        layers: [
            'road_barriers', 'fuel_stations',
            'electrician', 'ac_technician', 'plumber', 'general_maintenance',
            'painter', 'carpenter', 'blacksmith', 'builder', 'aluminum_tech',  'glass_tech',
            'house_cleaner', 'gardener', 'car_mechanic', 'car_electrician', 
            'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 
            'delivery_services', 'tow_truck', 'truck_driver', 'party_planner', 
            'zaffa_bands', 'music_bands', 'Finisher', 'party_rental', 
            'clown_entertainer', 'home_nurse', 'masseur', 'cupping_specialist', 
            'nutritionist', 'pet_care', 'cctv_installer', 'security_firms', 
            'furniture_buyer', 'online_stores', 'villas_rent', 'martial_arts_gymnastics',
            'public_parks_recreation', 'hotels', 'free_distribution', 'barber_shop',
            'video_design_ads', 'pharmacies_on_call', 'taxis_on_call', 'emergency_hospitals',
            'clinics', 'doctors_on_call', 'ambulances_on_call', 'music_training',
            'lawyers', 'land_surveyors', 'real_estate_valuers', 'private_tutors',
            'programmers', 'car_delivery_on_call', 'motorcycle_delivery_on_call',
            'bicycle_delivery_on_call', 'photographers', 'student_research_assist',
            'supermarket', 'commercial_shops', 'restaurants', 'schools_kindergartens',
            'job_vacancies', 'city_landmarks'
        ].filter(layerName => !window.isLayerGloballyExcluded(layerName))
    }
};

// دالة توحيد وتطبيع النصوص لواجهة المستخدم والترتيب اللحظي الفعال
window.normalizeArabic = function(text) {
    if (!text) return "";
    return text.toString()
        .replace(/[أإآا]/g, 'ا')
        .replace(/[ةه]/g, 'ه')
        .replace(/[ىي]/g, 'ي')
        .replace(/[ؤئء]/g, 'ء')
        .trim();
};

// دالة تحويل الكلمة إلى نمط SQL مرن يتجاوز عيوب الحروف المتشابهة إملائياً في GeoServer
function buildFlexibleArabicCQL(word) {
    let cleanWord = word.trim();
    if (cleanWord.length === 0) return "";

    // استبدال الحروف الحساسة إملائياً برمز الحرف العشوائي الموحد (_) لقاعدة البيانات
    let wildcardWord = cleanWord
        .replace(/[أإآا]/g, '_')
        .replace(/[ةه]/g, '_')
        .replace(/[ىي]/g, '_')
        .replace(/[ؤئء]/g, '_');

        return `(search_tags ILIKE '%${wildcardWord}%' OR des ILIKE '%${wildcardWord}%')`;}

// دالة تفكيك النص وبناء فلتر موحد ونظيف تماماً يتوافق مع الكلمات المتعددة والتطبيع
function buildUnifiedCQLFilter(term) {
    if (!term || term.trim() === "") return "1=1";

    const words = term.split(/\s+/).filter(word => word.trim().length > 0);
    if (words.length === 0) return "1=1";

    // توليد شروط مرنة لكل كلمة على حدة لتجاهل الفروقات الإملائية تماماً
    const conditions = words.map(word => buildFlexibleArabicCQL(word)).filter(q => q !== "");
    
    if (conditions.length === 0) return "1=1";
    return `(${conditions.join(' AND ')})`;
}

window.fetchGroupWFS = async function(groupKey, term) {
    const config = searchConfig[groupKey];
    if (!config) return [];

    const workspace = config.workspace;
    const layers = config.layers;
    const unifiedFilter = buildUnifiedCQLFilter(term);

    // البحث في جميع الطبقات في المجموعة
    const allFeatures = [];

    for (const layer of layers) {
        // الحصول على الاسم العربي للطبقة من serviceTranslations
        const layerKey = layer.replace('Layer', '').toLowerCase();
        const layerNameAr = window.serviceTranslations && window.serviceTranslations[layerKey] ? window.serviceTranslations[layerKey].name : null;

        // استخدام endpoint السيرفر للبحث (يدعم الآن OR بين كلمات الجملة وأعمدة
        // search_tags/des/name بشكل مركزي من داخل السيرفر نفسه)
        try {
            const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
            const params = new URLSearchParams({
                layer: layer,
                workspace: workspace,
                field: 'search_tags',
                operator: 'contains',
                value: term
            });

            if (layerNameAr) {
                params.append('layerNameAr', layerNameAr);
            }

            const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
            const data = await response.json();

            if (data && data.features) {
                const features = data.features.map(f => {
                    const layerName = f.properties.layerId || layer;
                    return {
                        ...f,
                        customTitle: layerAliases[layerName] || layerName,
                        layerId: layerName,
                        workspace: workspace
                    };
                });
                allFeatures.push(...features);
            }
        } catch (err) {
            // تجاهل خطأ طبقة واحدة ومتابعة باقي الطبقات
        }
    }

    // Fallback للبحث المباشر من GeoServer إذا لم توجد نتائج
    if (allFeatures.length === 0) {
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
            maxFeatures: '100'
        });

        try {
            const response = await fetch(`${MAP_CONFIG.server.proxyUrl}${workspace}/ows?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.features) {
                    const features = data.features.map(f => {
                        const layerName = f.id.split('.')[0];
                        return {
                            ...f,
                            customTitle: layerAliases[layerName] || layerName,
                            layerId: layerName,
                            workspace: workspace
                        };
                    });
                    allFeatures.push(...features);
                }
            }
        } catch (fallbackErr) {
            // تجاهل فشل المسار الاحتياطي
        }
    }

    // ترتيب النتائج حسب rating تنازلياً
    allFeatures.sort((a, b) => {
        const ratingA = parseFloat(a.properties?.rating) || 0;
        const ratingB = parseFloat(b.properties?.rating) || 0;
        return ratingB - ratingA;
    });

    return allFeatures;
}

// ==========================================================================
// 🆕 بحث بالكلمات الدلالية الخاصة بحالة حواجز الطرق وتوفر أنواع الوقود
// ==========================================================================
const ROAD_BARRIER_STATUS_KEYWORDS = {
    'مفتوح': ['0'],
    'مغلق': ['1'],
    'ازمة خفيفة': ['2'], 'أزمة خفيفة': ['2'],
    'ازمة خانقة': ['3'], 'أزمة خانقة': ['3'],
    'تفتيش': ['4'],
    'ازمة': ['2', '3', '4'], 'أزمة': ['2', '3', '4'],
    'حاجز': ['0', '1', '2', '3', '4'], 'حواجز': ['0', '1', '2', '3', '4']
};

const FUEL_AVAILABILITY_KEYWORDS = {
    'ديزل': 'diesel', 'سولار': 'diesel',
    'بنزين 95': 'banzen95', 'بنزين95': 'banzen95',
    'بنزين 98': 'banzen98', 'بنزين98': 'banzen98'
};

window.fetchSpecialStatusMatches = async function(term) {
    const results = [];
    if (!term || term.trim() === '') return results;
    const normalized = normalizeArabic(term.trim());
    const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");

    let matchedStops = null;
    Object.keys(ROAD_BARRIER_STATUS_KEYWORDS).forEach(keyword => {
        if (normalized.includes(normalizeArabic(keyword))) matchedStops = ROAD_BARRIER_STATUS_KEYWORDS[keyword];
    });

    if (matchedStops) {
        for (const stopVal of matchedStops) {
            try {
                const params = new URLSearchParams({
                    layer: 'road_barriers', workspace: 'services',
                    field_0: 'stop', operator_0: '=', value_0: stopVal, conditions_count: '1'
                });
                const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                if (response.ok) {
                    const data = await response.json();
                    if (data && data.features) {
                        const stopInfo = window.getRoadBarrierStopInfo ? window.getRoadBarrierStopInfo(stopVal) : { label: 'حاجز طرق' };
                        data.features.forEach(f => {
                            results.push({ ...f, customTitle: `حواجز الطرق - ${stopInfo.label}`, layerId: 'road_barriers', workspace: 'services' });
                        });
                    }
                }
            } catch (err) { /* تجاهل */ }
        }
    }

    let matchedFuelField = null;
    Object.keys(FUEL_AVAILABILITY_KEYWORDS).forEach(keyword => {
        if (normalized.includes(normalizeArabic(keyword))) matchedFuelField = FUEL_AVAILABILITY_KEYWORDS[keyword];
    });

    if (matchedFuelField) {
        try {
            const params = new URLSearchParams({
                layer: 'fuel_stations', workspace: 'services',
                field_0: matchedFuelField, operator_0: '=', value_0: '0', conditions_count: '1'
            });
            const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
            if (response.ok) {
                const data = await response.json();
                if (data && data.features) {
                    const fuelLabels = { diesel: 'ديزل', banzen95: 'بنزين 95', banzen98: 'بنزين 98' };
                    data.features.forEach(f => {
                        results.push({ ...f, customTitle: `محطات الوقود - متوفر ${fuelLabels[matchedFuelField]}`, layerId: 'fuel_stations', workspace: 'services' });
                    });
                }
            }
        } catch (err) { /* تجاهل */ }
    }

    return results;
};

window.initializeGlobalSearch = function() {
    const searchInput = document.getElementById('global-search-input');
    const suggestionsPanel = document.getElementById('search-suggestions');
    const refreshBtn = document.getElementById('global-refresh-btn');
    if (!searchInput || !suggestionsPanel) return;

    // زر تحديث الخريطة
    if (refreshBtn) {
        refreshBtn.onclick = () => {
            if (window.overlayLayersObj) {
                Object.values(window.overlayLayersObj).forEach(layer => {
                    if (layer && layer.getSource && typeof layer.getSource().refresh === 'function') {
                        layer.getSource().refresh();
                    }
                });
                alert('تم تحديث بيانات الخريطة بنجاح.');
            } else {
                alert('لم يتم العثور على الطبقات للتحديث.');
            }
        };
    }

    // إغلاق اللوحة عند النقر في أي مكان خارجها
    document.addEventListener('click', (e) => {
        if (suggestionsPanel && !suggestionsPanel.contains(e.target) && e.target !== searchInput) {
            suggestionsPanel.style.display = 'none';
        }
    });

    let timeout;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value;
        if (term.trim().length < 2) {
            suggestionsPanel.style.display = 'none';
            return;
        }

        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            // تنظيف اللوحة وإظهار حالة التحميل
            suggestionsPanel.innerHTML = '<div class="suggestion-item" style="padding:10px;">جاري البحث انتظر بضع ثواني ...</div>';
            suggestionsPanel.style.display = 'block';

            // 🆕 فحص حد الطلبات وتسجيله قبل تنفيذ البحث العالمي - يمنع التنفيذ فوراً عند التجاوز
            if (window.checkAndLogMapEvent) {
                const quotaCheck = await window.checkAndLogMapEvent('global_search', null, term);
                if (!quotaCheck.allowed) {
                    suggestionsPanel.style.display = 'none';
                    return;
                }
            }

            const promises = Object.keys(searchConfig).map(group => fetchGroupWFS(group, term));
            // 🆕 دمج نتائج البحث بالكلمات الدلالية الخاصة (حالة الحاجز / توفر الوقود)
            promises.push(window.fetchSpecialStatusMatches(term));
            const resultsArray = await Promise.all(promises);
            const allResults = resultsArray.flat();

            allResults.sort((a, b) => {
                const normTerm = normalizeArabic(term.trim());
                const normATitle = normalizeArabic(a.customTitle);
                const normBTitle = normalizeArabic(b.customTitle);

                const aAliasMatch = normATitle.includes(normTerm);
                const bAliasMatch = normBTitle.includes(normTerm);

                if (aAliasMatch && !bAliasMatch) return -1;
                if (!aAliasMatch && bAliasMatch) return 1;

                const aRating = parseFloat(a.properties.rating) || 0;
                const bRating = parseFloat(b.properties.rating) || 0;
                return bRating - aRating;
            });

            renderGlobalSuggestions(allResults, term);
        }, 400);
    });
};

function renderGlobalSuggestions(features, term) {
    const panel = document.getElementById('search-suggestions');
    
    if (!features || features.length === 0) {
        panel.innerHTML = '<div class="suggestion-item">لا توجد نتائج مطابقة</div>';
        return;
    }

    panel.innerHTML = '';
    features.slice(0, 50).forEach(f => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        item.style.padding = '8px 12px';
        item.style.borderBottom = '1px solid #eee';
        item.style.cursor = 'pointer';
        
        const props = f.properties;
        const rawMainName = props.name || props.location || props.location_name || "معلم غير مسمى";
        
        const subDetails = [
            f.customTitle,
            props.location || props.location_name,
            props.village_a,
            props.gov_a
        ].filter(t => t && t !== "").join(' | ');

        item.innerHTML = `
            <div>
                <div class="name" style="font-size: 14px; color: #222; font-weight:bold;">
                    <i class="fas fa-map-marker-alt" style="margin-left:8px; color:#e74c3c;"></i>${highlightMatch(rawMainName, term)}
                </div>
                <div class="sub" style="font-size:11px; color:#666; margin-right:24px;">${highlightMatch(subDetails, term)}</div>
            </div>
        `;

        item.onclick = () => {
            panel.style.display = 'none';
            zoomToGlobalFeature(f);
        };
        panel.appendChild(item);
    });
}

function highlightMatch(text, term) {
    if (!text || !term) return text || "";
    const words = term.split(/\s+/).filter(w => w.trim().length > 0);
    let highlightedText = text.toString();
    
    words.forEach(word => {
        // تم تكييف إبراز الكلمات ليتماشى بمرونة مع الحروف العربية المتشابهة في العرض
        let regexPattern = word.replace(/[أإآا]/g, '[أإآا]')
                              .replace(/[ةه]/g, '[ةه]')
                              .replace(/[ىي]/g, '[ىي]')
                              .replace(/[ؤئء]/g, '[ؤئء]');
                              
        const regex = new RegExp(`(${regexPattern})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<strong>$1</strong>');
    });
    return highlightedText;
}

function zoomToGlobalFeature(f) {
    if (!window.map) return;
    
    const feature = new ol.format.GeoJSON().readFeature(f);
    const geometry = feature.getGeometry();
    if (!geometry) return;

    if (window.searchResultsHighlightLayer) {
        const source = window.searchResultsHighlightLayer.getSource();
        source.clear();
        source.addFeature(feature);
    }

    const extent = geometry.getExtent();
    const center = ol.extent.getCenter(extent);
    window.map.getView().fit(extent, {
        duration: 1000,
        padding: [100, 100, 100, 100],
        maxZoom: 19
    });

    window.currentPopupCoordinate = center;

    const overlay = window.map.getOverlays().getArray().find(o =>
        o.getElement() && (o.getElement().id === 'popup' || o.getElement().classList.contains('ol-popup'))
    );

    if (overlay) {
        const content = document.getElementById('popup-content');
        const title = document.getElementById('popup-title');
        if (title) title.innerText = f.customTitle;

        content.innerHTML = window.generateFeatureHtml ?
            window.generateFeatureHtml(feature) :
            `<div style="padding:10px;"><strong>الاسم:</strong> ${f.properties.name || f.properties.location || 'غير متوفر'}</div>`;

        overlay.setPosition(center);
    }
}