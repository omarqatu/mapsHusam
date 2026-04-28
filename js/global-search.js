/**
 * global-search.js - النسخة المفلترة بدقة (Strict filtering)
 * حل مشكلة ظهور الخدمات عند البحث عن "للبيع" أو "شقة"
 */

const layerAliases = {
    'ApartRent': 'شقة للإيجار', 'ApartSale': 'شقة للبيع', 'LandSale': 'أرض للبيع',
    'electrician': 'فني كهرباء', 'ac_technician': 'فني تكييف وتبريد', 'plumber': 'سباك (مواسيرجي)',
    'general_maintenance': 'صيانة عامة', 'painter': 'دهان وديكور', 'carpenter': 'نجار',
    'blacksmith': 'حداد', 'builder': 'بناء ومعمار', 'aluminum_tech': 'فني ألمنيوم',
    'house_cleaner': 'خدمات تنظيف تعزيل', 'gardener': 'تنسيق حدائق', 'car_mechanic': 'ميكانيكي سيارات',
    'car_electrician': 'كهربائي سيارات', 'tire_tech': 'بنشري / إطارات', 'car_wash': 'غسيل سيارات',
    'motorcycle_repair': 'صيانة دراجات نارية', 'taxi_driver': 'مكتب تاكسي', 'delivery_services': 'خدمات توصيل',
    'tow_truck': 'ونش إنقاذ / سطحة', 'truck_driver': 'سائق شاحنة', 'party_planner': 'منظم حفلات',
    'zaffa_bands': 'فرق زفة أعراس', 'music_bands': 'فرق موسيقية', 'photographer': 'مصور فوتوغرافي',
    'party_rental': 'تأجير مستلزمات حفلات', 'clown_entertainer': 'مهرج وعروض أطفال',
    'home_nurse': 'تمريض منزلي', 'masseur': 'أخصائي مساج', 'cupping_specialist': 'أخصائي حجامة',
    'nutritionist': 'أخصائي تغذية', 'pet_care': 'رعاية حيوانات أليفة', 'cctv_installer': 'فني كاميرات مراقبة',
    'security_firms': 'شركات أمن وحراسة', 'furniture_buyer': 'شراء أثاث مستعمل'
};

const smartSynonyms = {
    'عامل': ['electrician', 'plumber', 'painter', 'builder', 'carpenter', 'blacksmith', 'general_maintenance', 'aluminum_tech'],
    'فني': ['electrician', 'ac_technician', 'plumber', 'aluminum_tech', 'cctv_installer'],
    'سيارة': ['car_mechanic', 'car_electrician', 'tire_tech', 'car_wash', 'tow_truck'],
    'حفلة': ['party_planner', 'zaffa_bands', 'music_bands', 'photographer', 'party_rental', 'clown_entertainer'],
    'صحة': ['home_nurse', 'masseur', 'cupping_specialist', 'nutritionist'],
    'توصيل': ['taxi_driver', 'delivery_services', 'truck_driver', 'tow_truck'],
    'كهرباء': 'electrician', 'كهربجي': 'electrician',
    'سباك': 'plumber', 'مواسرجي': 'plumber', 'صحية': 'plumber',
    'ايجار': 'ApartRent', 'اجار': 'ApartRent', 'للايجار': 'ApartRent',
    'بيع': 'ApartSale', 'للبيع': 'ApartSale', 'تمليك': 'ApartSale', 
    'شقه': 'ApartSale', 'شقة': 'ApartSale', 'شقق': 'ApartSale',
    'اراضي': 'LandSale', 'ارض': 'LandSale', 'نمرة': 'LandSale',
    'مكيف': 'ac_technician', 'تكييف': 'ac_technician',
    'دهان': 'painter', 'دهين': 'painter',
    'بناء': 'builder', 'عمار': 'builder',
    'زفة': 'zaffa_bands', 'زفه': 'zaffa_bands'
};

const searchConfig = {
    'realestate': {
        workspace: 'realestate',
        layers: ['ApartRent', 'ApartSale', 'LandSale'], 
        fields: ['location', 'price', 'des', 'area', 'gov_a', 'village_a']
    },
    'services': {
        workspace: 'services',
        layers: [
            'electrician', 'ac_technician', 'plumber', 'general_maintenance', 
            'painter', 'carpenter', 'blacksmith', 'builder', 'aluminum_tech',
            'house_cleaner', 'gardener', 'car_mechanic', 'car_electrician', 
            'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 
            'delivery_services', 'tow_truck', 'truck_driver', 'party_planner', 
            'zaffa_bands', 'music_bands', 'photographer', 'party_rental', 
            'clown_entertainer', 'home_nurse', 'masseur', 'cupping_specialist', 
            'nutritionist', 'pet_care', 'cctv_installer', 'security_firms', 
            'furniture_buyer'
        ],
        fields: ['name', 'location_name', 'gov_a', 'village_a', 'des']
    }
};

function normalizeArabic(text) {
    if (!text) return "";
    return text.toString().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').trim();
}

/**
 * دالة البحث المطورة - المنطق الجديد
 */
async function fetchGroupWFS(groupKey, term) {
    const config = searchConfig[groupKey];
    const normalizedTerm = normalizeArabic(term);
    const workspace = config.workspace;
    
    let targetLayers = [];
    let isSmartMatchActive = false;

    // 1. فحص القاموس الذكي (تطابق دقيق أو الكلمة تبدأ بالمصطلح)
    // الحل هنا: إذا كان المصطلح هو "بيع" أو "للبيع"، لا نسمح له بتفعيل "فني"
    for (let syn in smartSynonyms) {
        const normalizedSyn = normalizeArabic(syn);
        
        // شرط التطابق الدقيق أو أن تكون الكلمة جزءاً حقيقياً منها (وليس مجرد حروف)
        if (normalizedSyn === normalizedTerm || (normalizedTerm.length >= 3 && normalizedSyn.includes(normalizedTerm))) {
            let val = smartSynonyms[syn];
            let matchedLayers = Array.isArray(val) ? val : [val];
            
            // فلترة الطبقات: نأخذ فقط الطبقات التي تنتمي فعلياً للمجموعة الحالية (realestate أو services)
            let layersForThisGroup = matchedLayers.filter(l => config.layers.includes(l));
            
            if (layersForThisGroup.length > 0) {
                targetLayers = targetLayers.concat(layersForThisGroup);
                isSmartMatchActive = true;
            }
        }
    }

    // 2. إذا لم يكن هناك Match ذكي، نستخدم كل طبقات المجموعة للبحث النصي العادي
    const finalLayers = isSmartMatchActive ? [...new Set(targetLayers)] : config.layers;
    const typeNames = finalLayers.map(l => `${workspace}:${l}`).join(',');

    const fieldFilters = config.fields
        .map(f => (f === 'area' || f === 'price') ? `(strCast(${f}) ILIKE '%${term}%')` : `(${f} ILIKE '%${term}%')`)
        .join(' OR ');

    // التصحيح القاتل: إذا كان Match ذكي، نبحث في الحقول OR (1=1). 
    // ولكن لضمان عدم تداخل المجموعات، fetchGroupWFS تُستدعى مرتين (مرة لكل مجموعة)
    // فإذا كنت تبحث عن "للبيع"، مجموعة الخدمات لن تجد Match ذكي في قاموسها، فستبحث نصياً فقط.
    let cqlFilter = isSmartMatchActive ? `(${fieldFilters}) OR (1=1)` : fieldFilters;

    const params = new URLSearchParams({
        service: 'WFS', version: '1.1.0', request: 'GetFeature',
        typeName: typeNames,
        outputFormat: 'application/json',
        srsname: 'EPSG:28191',
        CQL_FILTER: cqlFilter,
        maxFeatures: isSmartMatchActive ? '50' : '20'
    });

    try {
        const response = await fetch(`http://localhost:8080/geoserver/ows?${params.toString()}`);
        if (!response.ok) return [];
        const data = await response.json();
        if (!data || !data.features) return [];

        return data.features.map(f => {
            const layerName = f.id.split('.')[0];
            return {
                ...f,
                customTitle: layerAliases[layerName] || layerName,
                layerId: layerName,
                workspace: workspace
            };
        });
    } catch (err) {
        console.error(`Error in group ${groupKey}:`, err);
        return [];
    }
}

window.initializeGlobalSearch = function() {
    const searchInput = document.getElementById('global-search-input');
    const suggestionsPanel = document.getElementById('search-suggestions');
    if (!searchInput || !suggestionsPanel) return;

    let timeout;
    searchInput.addEventListener('input', (e) => {
        const term = e.target.value.trim();
        if (term.length < 2) {
            suggestionsPanel.style.display = 'none';
            return;
        }

        clearTimeout(timeout);
        timeout = setTimeout(async () => {
            suggestionsPanel.innerHTML = '<div class="suggestion-item"><i class="fas fa-spinner fa-spin"></i> جاري البحث...</div>';
            suggestionsPanel.style.display = 'block';

            // استدعاء المجموعتين بالتوازي
            const promises = Object.keys(searchConfig).map(group => fetchGroupWFS(group, term));
            const resultsArray = await Promise.all(promises);
            const allResults = resultsArray.flat();

            // الترتيب: الأولوية للتطابق مع اسم الطبقة (مثل شقة للبيع)
            allResults.sort((a, b) => {
                const aM = normalizeArabic(a.customTitle).includes(normalizeArabic(term));
                const bM = normalizeArabic(b.customTitle).includes(normalizeArabic(term));
                if (aM && !bM) return -1;
                if (!aM && bM) return 1;
                return 0;
            });

            renderGlobalSuggestions(allResults, term);
        }, 400);
    });
};

function renderGlobalSuggestions(features, term) {
    const panel = document.getElementById('search-suggestions');
    if (!features || features.length === 0) {
        panel.innerHTML = '<div class="suggestion-item">لا توجد نتائج</div>';
        return;
    }

    panel.innerHTML = '';
    features.slice(0, 30).forEach(f => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        
        const props = f.properties;
        const rawMainName = props.name || props.location || props.location_name || "بدون اسم";
        const subDetails = [
            f.customTitle,
            props.location || props.location_name,
            props.village_a,
            props.gov_a
        ].filter(t => t && t !== "").join('، ');

        item.innerHTML = `
            <div class="name" style="font-size: 14px; color: #222; font-weight:bold;">
                <i class="fas fa-map-marker-alt" style="margin-left:8px; color:#e74c3c;"></i>${highlightMatch(rawMainName, term)}
            </div>
            <div class="sub" style="font-size:11px; color:#666; margin-right:24px;">${highlightMatch(subDetails, term)}</div>
        `;

        item.onclick = () => {
            document.getElementById('global-search-input').value = rawMainName;
            panel.style.display = 'none';
            zoomToGlobalFeature(f);
        };
        panel.appendChild(item);
    });
}

function highlightMatch(text, term) {
    if (!text || !term) return text || "";
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.toString().replace(regex, '<strong>$1</strong>');
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
    window.map.getView().fit(extent, { duration: 1000, padding: [100, 100, 100, 100], maxZoom: 19 });

    const overlay = window.map.getOverlays().getArray().find(o => o.getElement() && (o.getElement().id === 'popup' || o.getElement().classList.contains('ol-popup')));
    if (overlay) {
        const content = document.getElementById('popup-content');
        const title = document.getElementById('popup-title');
        if (title) title.innerText = f.customTitle;
        content.innerHTML = window.generateFeatureHtml ? window.generateFeatureHtml(feature) : `<div style="padding:5px;">${JSON.stringify(f.properties)}</div>`;
        overlay.setPosition(ol.extent.getCenter(extent));
    }
}