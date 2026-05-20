/**
 * layers.js - النسخة الديناميكية الشاملة (59 خدمة)
 * تشمل: الأيقونات المخصصة، الإيموجي، والمحرك الذي يقرأ من MAP_CONFIG
 * التعديلات: إضافة Z-Index للطبقات وتنسيق وحدة المساحة م²
 */

// 1. تعريف ترجمات وأيقونات الخدمات (الـ 34 القديمة + الـ 25 الجديدة)
const serviceTranslations = {
    // --- الخدمات القديمة (34) ---
    'electrician': { name: 'فني كهرباء', icon: '⚡' },
    'ac_technician': { name: 'فني تكييف وتبريد', icon: '❄️' },
    'plumber': { name: 'سباك (مواسيرجي)', icon: '🔧' },
    'general_maintenance': { name: 'صيانة عامة', icon: '🛠️' },
    'painter': { name: 'دهان وديكور', icon: '🎨' },
    'carpenter': { name: 'نجار', icon: '🪵' },
    'blacksmith': { name: 'حداد', icon: '🔨' },
    'builder': { name: 'بناء ومعمار', icon: '🧱' },
    'house_cleaner': { name: 'خدمات تنظيف', icon: '🧹' },
    'aluminum_tech': { name: 'فني ألمنيوم', icon: '🪟' },
    'car_mechanic': { name: 'ميكانيكي سيارات', icon: '🚗' },
    'car_electrician': { name: 'كهربائي سيارات', icon: '🔌' },
    'tire_tech': { name: 'بنشري / إطارات', icon: '🛞' },
    'car_wash': { name: 'غسيل سيارات', icon: '🧼' },
    'motorcycle_repair': { name: 'صيانة دراجات نارية', icon: '🏍️' },
    'taxi_driver': { name: 'مكتب تاكسي', icon: '🚕' },
    'delivery_services': { name: 'خدمات توصيل', icon: '📦' },
    'tow_truck': { name: 'ونش إنقاذ', icon: '🛻' },
    'cctv_installer': { name: 'فني كاميرات مراقبة', icon: '📹' },
    'party_planner': { name: 'منظم حفلات', icon: '🎈' },
    'zaffa_bands': { name: 'فرقة زفة', icon: '🥁' },
    'music_bands': { name: 'فرق موسيقية', icon: '🎸' },
    'photographer': { name: 'مصور فوتوغرافي', icon: '📸' },
    'party_rental': { name: 'تأجير مستلزمات حفلات', icon: '🎪' },
    'home_nurse': { name: 'تمريض منزلي', icon: '🩺' },
    'masseur': { name: 'أخصائي مساج', icon: '💆' },
    'cupping_specialist': { name: 'أخصائي حجامة', icon: '🍵' },
    'nutritionist': { name: 'أخصائي تغذية', icon: '🥗' },
    'truck_driver': { name: 'سائق شاحنة', icon: '🚛' },
    'security_firms': { name: 'شركات أمن وحراسة', icon: '🛡️' },
    'furniture_buyer': { name: 'شراء أثاث مستعمل', icon: '🛋️' },
    'gardener': { name: 'تنسيق حدائق', icon: '🌿' },
    'pet_care': { name: 'رعاية حيوانات أليفة', icon: '🐾' },
    'clown_entertainer': { name: 'مهرج وعروض أطفال', icon: '🤡' },

    // --- الخدمات الجديدة (25) ---
    'online_stores': { name: 'متاجر أون لاين', icon: '🛒' },
    'villas_rent': { name: 'فلل أجار', icon: '🏡' },
    'martial_arts_gymnastics': { name: 'فنون قتالية وجمباز', icon: '🥋' },
    'public_parks_recreation': { name: 'حدائق ومناطق ترفيهية', icon: '🌳' },
    'hotels': { name: 'فنادق', icon: '🏨' },
    'free_distribution': { name: 'توزيع أغراض مجاناً', icon: '🎁' },
    'barber_shop': { name: 'حلاقة شباب', icon: '💈' },
    'video_design_ads': { name: 'تصميم فيديو إعلاني', icon: '🎬' },
    'pharmacies_on_call': { name: 'صيدليات مناوبة', icon: '💊' },
    'taxis_on_call': { name: 'تكاسي نظام مناوبة', icon: '🚕' },
    'emergency_hospitals': { name: 'طوارئ ومستشفيات', icon: '🏥' },
    'clinics': { name: 'عيادات', icon: '🩺' },
    'doctors_on_call': { name: 'دكاترة مناوبة', icon: '👨‍⚕️' },
    'ambulances_on_call': { name: 'إسعاف مناوبة', icon: '🚑' },
    'music_training': { name: 'تدريب موسيقى ومعاهد', icon: '🎹' },
    'lawyers': { name: 'محاميين', icon: '⚖️' },
    'land_surveyors': { name: 'مساحين أراضي', icon: '📐' },
    'real_estate_valuers': { name: 'مخمنين عقاريين', icon: '📊' },
    'private_tutors': { name: 'أساتذة خصوصي', icon: '👨‍🏫' },
    'programmers': { name: 'مبرمجين', icon: '💻' },
    'car_delivery_on_call': { name: 'دليفري سيارات (مناوبة)', icon: '🚗' },
    'motorcycle_delivery_on_call': { name: 'دليفري دراجات (مناوبة)', icon: '🏍️' },
    'bicycle_delivery_on_call': { name: 'دليفري هوائية (مناوبة)', icon: '🚲' },
    'photographers': { name: 'مصور فوتوغرافي', icon: '📷' },
    'student_research_assist': { name: 'مساعد أبحاث طلاب', icon: '📚' }
};

// 2. دالة إنشاء الستايلات مع إضافة "م²" للمساحات
window.createStyle = function (feature, resolution, options = {}) {
    const opts = { 
        fillColor: null, strokeColor: '#000', strokeWidth: 2, 
        labelField: null, iconUrl: null, iconScale: 0.8, 
        zoomThresholdForLabel: 0.9, emoji: null, ...options 
    };

    let text = '';
    if (opts.labelField && resolution < opts.zoomThresholdForLabel) {
        const val = feature.get(opts.labelField);
        if (val) {
            // إضافة م² إذا كان الحقل هو المساحة
            if (opts.labelField === 'area') {
                text = val.toString() + ' م²';
            } else {
                text = val.toString();
            }
        }
    }

    let styleOptions = {
        text: new ol.style.Text({
            text: text, 
            font: 'bold 15px Arial, sans-serif', 
            fill: new ol.style.Fill({ color: '#333' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }), 
            overflow: true, 
            offsetY: (opts.emoji || opts.iconUrl) ? -25 : -10 
        })
    };

    const geomType = feature.getGeometry().getType();

    if (geomType.includes('Point')) {
        if (opts.iconUrl) {
            styleOptions.image = new ol.style.Icon({
                anchor: [0.5, 0.5],
                src: opts.iconUrl,
                scale: opts.iconScale
            });
        } 
        else if (opts.emoji) {
            styleOptions.image = new ol.style.Icon({
                anchor: [0.5, 0.5],
                src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30">
                        <circle cx="15" cy="15" r="13" fill="white" stroke="%233f51b5" stroke-width="1.5"/>
                        <text x="50%" y="50%" font-size="25" text-anchor="middle" dy=".35em">${opts.emoji}</text>
                    </svg>`
                ),
                scale: 0.75
            });
        } 
        else {
            styleOptions.image = new ol.style.Circle({ 
                radius: 7, 
                fill: new ol.style.Fill({ color: opts.fillColor || 'rgba(0,0,0,0.7)' }), 
                stroke: new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth })
            });
        }
    } else {
        if (opts.fillColor) styleOptions.fill = new ol.style.Fill({ color: opts.fillColor.replace('1)', '0.1)') });
        styleOptions.stroke = new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth });
        if (geomType.includes('Line')) styleOptions.text.setPlacement('line');
    }
    return new ol.style.Style(styleOptions);
};

// 3. ستايلات الطبقات المخصصة
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });
window.styleRent = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 102, 0, 1)', iconUrl: 'icons/rent_icon.png', iconScale: 0.10, labelField: 'area' });
window.styleSale = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(0, 128, 0, 1)', iconUrl: 'icons/sale_icon.png', iconScale: 0.15, labelField: 'area' });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area' });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 10 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 20 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });

// 4. الطبقات الأساسية الثابتة
const osmBaseLayer = new ol.layer.Tile({ title: 'OSM', visible: false, type: 'base', source: new ol.source.OSM(), zIndex: 0 });
const esriImageryLayer = new ol.layer.Tile({ title: 'Esri', visible: false, type: 'base', source: new ol.source.XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }), zIndex: 0 });
const aerialLayer = new ol.layer.Tile({ title: 'Aerial', visible: true, type: 'base', source: new ol.source.TileWMS({ url: `${MAP_CONFIG.server.proxyUrl}SurdaAbuQash/wms`, params: { 'LAYERS': 'SurdaAbuQash:AerialPhoto_Ramallah', 'CRS': MAP_CONFIG.server.srsName } }), zIndex: 0 });
const noBasemapLayer = new ol.layer.Vector({ title: 'None', visible: false, type: 'base', source: new ol.source.Vector(), zIndex: 0 });

// 5. المحرك الديناميكي لإنشاء طبقات WFS مع إضافة باراميتر zIndex
const createWFSLayer = (workspace, name, title, styleFunc, maxRes = 10, visible = true, zIndex = 10) => {
    return new ol.layer.Vector({
        title: title,
        visible: visible,
        maxResolution: maxRes,
        style: styleFunc,
        zIndex: zIndex,
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: `${MAP_CONFIG.server.proxyUrl}${workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${workspace}:${name}&outputFormat=application%2Fjson&srsName=${MAP_CONFIG.server.srsName}`,
            strategy: ol.loadingstrategy.all
        })
    });
};

// 6. تجميع كافة الطبقات في Object واحد
window.appLayers = { 
    osmBaseLayer, esriImageryLayer, aerialLayer, noBasemapLayer
};

// توليد طبقات المساعدة آلياً (المناطق تكون في الأسفل Z-Index: 5)
MAP_CONFIG.layers.helper.forEach(l => {
    window.appLayers[l.id] = createWFSLayer(l.workspace, l.name, l.title, eval(l.style), l.maxRes, l.visible !== false, 5);
});

// توليد طبقات العقارات آلياً (الأراضي Z-Index: 10، الشقق Z-Index: 20)
MAP_CONFIG.layers.realestate.forEach(l => {
    let zIndex = 20; 
    if (l.id.includes('land') || l.name.includes('land')) zIndex = 10; 
    window.appLayers[l.id] = createWFSLayer(l.workspace, l.name, l.title, eval(l.style), l.maxRes || 10, true, zIndex);
});

// توليد كافة طبقات الخدمات (59 خدمة) آلياً (تكون في الأعلى Z-Index: 30)
Object.keys(serviceTranslations).forEach(key => {
    const info = serviceTranslations[key];
    const sStyle = (f, r) => window.createStyle(f, r, { 
        emoji: info.icon, 
        labelField: 'name', 
        zoomThresholdForLabel: 0.7 
    });
    window.appLayers[key + 'Layer'] = createWFSLayer('services', key, info.name, sStyle, 4, true, 30); 
});

// 7. طبقات البحث والتمييز (أعلى شيء Z-Index: 1000)
window.appLayers.searchMarkerLayer = new ol.layer.Vector({ 
    source: new ol.source.Vector(), 
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12, fill: new ol.style.Fill({ color: '#ff0000' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 })
        })
    }), 
    zIndex: 1000 
});

window.appLayers.searchResultsHighlightLayer = new ol.layer.Vector({ 
    source: new ol.source.Vector(), 
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10, fill: new ol.style.Fill({ color: '#ffff00' }),
            stroke: new ol.style.Stroke({ color: '#333333', width: 2 })
        }),
        stroke: new ol.style.Stroke({ color: '#ffff00', width: 4 }),
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.3)' })
    }), 
    zIndex: 1001 
});