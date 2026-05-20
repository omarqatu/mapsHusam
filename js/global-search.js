/**
 * global-search.js - النسخة الاحترافية الشاملة 2026
 * تشمل كافة الطبقات الـ 59 (عقارات + خدمات قديمة + خدمات جديدة)
 * البحث في حقل search_tags + الترتيب حسب حقل rating (0-10)
 */

const layerAliases = {
    // --- العقارات ---
    'ApartRent': 'شقة للإيجار', 
    'ApartSale': 'شقة للبيع', 
    'LandSale': 'أرض للبيع',
    
    // --- الخدمات القديمة (34) ---
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
    'security_firms': 'شركات أمن وحراسة', 'furniture_buyer': 'شراء أثاث مستعمل',

    // --- الخدمات الجديدة (25) ---
    'online_stores': 'متاجر أون لاين', 'villas_rent': 'فلل أجار', 
    'martial_arts_gymnastics': 'فنون قتالية وجمباز', 'public_parks_recreation': 'حدائق ومناطق ترفيهية',
    'hotels': 'فنادق', 'free_distribution': 'توزيع أغراض مجاناً', 
    'barber_shop': 'حلاقة شباب', 'video_design_ads': 'تصميم فيديو إعلاني', 
    'pharmacies_on_call': 'صيدليات مناوبة', 'taxis_on_call': 'تكاسي نظام مناوبة', 
    'emergency_hospitals': 'طوارئ ومستشفيات', 'clinics': 'عيادات', 
    'doctors_on_call': 'دكاترة مناوبة', 'ambulances_on_call': 'إسعاف مناوبة', 
    'music_training': 'تدريب موسيقى ومعاهد', 'lawyers': 'محاميين', 
    'land_surveyors': 'مساحين أراضي', 'real_estate_valuers': 'مخمنين عقاريين', 
    'private_tutors': 'أساتذة خصوصي', 'programmers': 'مبرمجين', 
    'car_delivery_on_call': 'دليفري سيارات (مناوبة)', 'motorcycle_delivery_on_call': 'دليفري دراجات (مناوبة)', 
    'bicycle_delivery_on_call': 'دليفري هوائية (مناوبة)', 'photographers': 'مصور فوتوغرافي', 
    'student_research_assist': 'مساعد أبحاث طلاب'
};

const searchConfig = {
    'realestate': {
        workspace: 'realestate',
        layers: ['ApartRent', 'ApartSale', 'LandSale']
    },
    'services': {
        workspace: 'services',
        layers: [
            // كافة خدمات الـ WFS في GeoServer
            'electrician', 'ac_technician', 'plumber', 'general_maintenance', 
            'painter', 'carpenter', 'blacksmith', 'builder', 'aluminum_tech',
            'house_cleaner', 'gardener', 'car_mechanic', 'car_electrician', 
            'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 
            'delivery_services', 'tow_truck', 'truck_driver', 'party_planner', 
            'zaffa_bands', 'music_bands', 'photographer', 'party_rental', 
            'clown_entertainer', 'home_nurse', 'masseur', 'cupping_specialist', 
            'nutritionist', 'pet_care', 'cctv_installer', 'security_firms', 
            'furniture_buyer', 'online_stores', 'villas_rent', 'martial_arts_gymnastics',
            'public_parks_recreation', 'hotels', 'free_distribution', 'barber_shop',
            'video_design_ads', 'pharmacies_on_call', 'taxis_on_call', 'emergency_hospitals',
            'clinics', 'doctors_on_call', 'ambulances_on_call', 'music_training',
            'lawyers', 'land_surveyors', 'real_estate_valuers', 'private_tutors',
            'programmers', 'car_delivery_on_call', 'motorcycle_delivery_on_call',
            'bicycle_delivery_on_call', 'photographers', 'student_research_assist'
        ]
    }
};

function normalizeArabic(text) {
    if (!text) return "";
    return text.toString()
        .replace(/[أإآ]/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/ؤ/g, 'و')
        .replace(/ئ/g, 'ي')
        .trim();
}

function buildEnhancedLayerCQL(term, layerName) {
    const normalizedTerm = normalizeArabic(term);
    const words = normalizedTerm.split(/\s+/).filter(word => word.length > 0);
    const arabicAlias = layerAliases[layerName] || "";
    const normalizedAlias = normalizeArabic(arabicAlias);

    const isAliasMatch = normalizedAlias.includes(normalizedTerm);
    const tagFilters = words.map(word => `search_tags ILIKE '%${word}%'`).join(' AND ');

    if (isAliasMatch) {
        return `(${tagFilters}) OR (1=1)`; 
    } else {
        return tagFilters;
    }
}

async function fetchGroupWFS(groupKey, term) {
    const config = searchConfig[groupKey];
    const workspace = config.workspace;
    const layers = config.layers;
    const typeNames = layers.map(l => `${workspace}:${l}`).join(',');
    
    const layeredCql = layers.map(layer => {
        const filter = buildEnhancedLayerCQL(term, layer);
        return `(${filter})`;
    }).join(';');

    const params = new URLSearchParams({
        service: 'WFS',
        version: '1.1.0',
        request: 'GetFeature',
        typeName: typeNames,
        outputFormat: 'application/json',
        srsname: 'EPSG:28191',
        CQL_FILTER: layeredCql,
        sortBy: 'rating D', 
        maxFeatures: '100'
    });

    try {
        const response = await fetch(`${MAP_CONFIG.server.proxyUrl}${workspace}/ows?${params.toString()}`);
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

            const promises = Object.keys(searchConfig).map(group => fetchGroupWFS(group, term));
            const resultsArray = await Promise.all(promises);
            const allResults = resultsArray.flat();

            allResults.sort((a, b) => {
                const normTerm = normalizeArabic(term);
                const aAliasMatch = normalizeArabic(a.customTitle).includes(normTerm);
                const bAliasMatch = normalizeArabic(b.customTitle).includes(normTerm);

                if (aAliasMatch && !bAliasMatch) return -1;
                if (!aAliasMatch && bAliasMatch) return 1;

                const aRating = parseFloat(a.properties.rating) || 0;
                const bRating = parseFloat(b.properties.rating) || 0;
                if (aRating !== bRating) {
                    return bRating - aRating;
                }
                return 0;
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
    const words = term.split(/\s+/).filter(w => w.length > 0);
    let highlightedText = text.toString();
    
    words.forEach(word => {
        const regex = new RegExp(`(${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
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
    window.map.getView().fit(extent, { 
        duration: 1000, 
        padding: [100, 100, 100, 100], 
        maxZoom: 21 
    });

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
            
        overlay.setPosition(ol.extent.getCenter(extent));
    }
}