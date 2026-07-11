/**
 * layers.js - النسخة الديناميكية الشاملة والمطورة (59 خدمة) - مع دعم الاستثناءات العالمية
 * تشمل: الأيقونات المخصصة، الإيموجي، والمحرك الذي يقرأ من MAP_CONFIG
 * التعديلات: إصلاح استدعاء الستايلات الديناميكية لضمان عودة السيمبولوجي الأصلي (أيقونات الإيجار والبيع والأراضي) بالكامل.
 */

// 1. تعريف ترجمات وأيقونات الخدمات (الـ 59 خدمة كاملة)
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

// جعل serviceTranslations متاحة عالمياً للاستخدام في ملفات أخرى (مثل quick-search.js)
window.serviceTranslations = serviceTranslations;

// 2. دالة إنشاء الستايلات العامة والمطورة مع إضافة "م²" للمساحات وحماية النصوص الجغرافية
window.createStyle = function (feature, resolution, options = {}) {
    const opts = { 
        fillColor: null, strokeColor: '#000', strokeWidth: 2, 
        labelField: null, iconUrl: null, iconScale: MAP_CONFIG.uiStyle.defaultIconScale, 
        zoomThresholdForLabel: 0.9, emoji: null, ...options 
    };

    // إذا كانت الطبقة تمتلك إعداد خاص في الكومفيج، نستخدمه
    const currentRes = resolution;
    const threshold = opts.zoomThresholdForLabel;

    let text = '';
    if (opts.labelField && currentRes < threshold) {
        const val = feature.get(opts.labelField);
        if (val !== undefined && val !== null) {
            // التحقق الذكي لإضافة وحدة م² إذا كان الحقل يعبر عن المساحة
            if (opts.labelField === 'area' || opts.labelField.toLowerCase().includes('area')) {
                text = val.toString() + ' م²';
            } else {
                text = val.toString();
            }
        }
    }

    let styleOptions = {
        text: new ol.style.Text({
            text: text, 
            font: MAP_CONFIG.uiStyle.labelFont, 
            fill: new ol.style.Fill({ color: MAP_CONFIG.uiStyle.labelColor }),
            stroke: new ol.style.Stroke({ color: MAP_CONFIG.uiStyle.labelOutline, width: 3 }), 
            overflow: true, 
            offsetY: (opts.emoji || opts.iconUrl) ? -25 : -10 
        })
    };

    // التحقق الآمن من نوع الهندسة الجغرافية منعاً لانهيار التنسيق
    const geom = feature.getGeometry();
    const geomType = geom ? geom.getType() : 'Point';

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
                    `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
                        <circle cx="16" cy="16" r="14" fill="white" stroke="%233f51b5" stroke-width="2"/>
                        <text x="16" y="23" font-size="20" font-family="Arial, sans-serif" text-anchor="middle">${opts.emoji}</text>
                    </svg>`
                ),
                scale: 1.0
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
        if (opts.fillColor) {
            let fColor = opts.fillColor;
            if (fColor.startsWith('rgba')) {
                fColor = fColor.replace(/[^,]+(?=\))/, '0.15');
            }
            styleOptions.fill = new ol.style.Fill({ color: fColor });
        }
        styleOptions.stroke = new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth });
        if (geomType.includes('Line')) styleOptions.text.setPlacement('line');
    }
    return new ol.style.Style(styleOptions);
};

// 3. ستايلات الطبقات المخصصة والمعرفة في النطاق العالمي
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });
window.styleRent = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 102, 0, 1)', iconUrl: 'icons/rent_icon.png', iconScale: 0.12, labelField: 'area', zoomThresholdForLabel: 0.8 });
window.styleSale = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(0, 128, 0, 1)', iconUrl: 'icons/sale_icon.png', iconScale: 0.18, labelField: 'area', zoomThresholdForLabel: 0.8 });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area', zoomThresholdForLabel: 1.2 });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 5 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 30 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });

// 4. الطبقات الأساسية الثابتة
const osmBaseLayer = new ol.layer.Tile({ title: 'OSM', visible: false, type: 'base', source: new ol.source.OSM(), zIndex: 0 });
const esriImageryLayer = new ol.layer.Tile({ title: 'Esri', visible: true, type: 'base', maxZoom: 22, source: new ol.source.XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom: 19 }), zIndex: 0 });
const aerialLayer = new ol.layer.Tile({ title: 'Aerial', visible: false, type: 'base', source: new ol.source.TileWMS({ url: `${MAP_CONFIG.server.proxyUrl}madeenati/wms`, params: { 'LAYERS': 'madeenati:WB_2023_10_18mbt', 'CRS': MAP_CONFIG.server.srsName, 'FORMAT': 'image/jpeg', 'TILED': true }, serverType: 'geoserver', crossOrigin: 'anonymous' }), zIndex: 0 });
const noBasemapLayer = new ol.layer.Vector({ title: 'None', visible: false, type: 'base', source: new ol.source.Vector(), zIndex: 0 });

// 5. المحرك الديناميكي الآمن لإنشاء طبقات WFS وتغذيتها بالبيانات
const createWFSLayer = (workspace, name, title, styleFunc, maxRes = 10, visible = true, zIndex = 10) => {
    return new ol.layer.Vector({
        title: title,
        visible: visible,
        maxResolution: maxRes,
        style: styleFunc,
        zIndex: zIndex,
        source: new ol.source.Vector({
            format: new ol.format.GeoJSON(),
            url: function(extent) {
                // جلب البيانات حسب المدى المرئي (BBOX) لتحسين الأداء
                return `${MAP_CONFIG.server.proxyUrl}${workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${workspace}:${name}&outputFormat=application%2Fjson&srsName=${MAP_CONFIG.server.srsName}&bbox=${extent.join(',')},${MAP_CONFIG.server.srsName}`;
            },
            strategy: ol.loadingstrategy.bbox
        })
    });
};

// دالة وسيطة ذكية لاستخراج الستايل الصحيح لمنع اختفاء السيمبولوجي المخصص
const getLayerStyle = (styleParam, fallbackColor) => {
    // دالة افتراضية تضمن ظهور المعلم حتى لو فشل الستايل (لون واضح مع تعبئة خفيفة)
    const defaultFallback = (f, r) => window.createStyle(f, r, { strokeColor: fallbackColor, fillColor: fallbackColor + '33' });

    if (!styleParam) return defaultFallback;
    
    // إذا كان ممرراً كـ دالة مباشرة
    if (typeof styleParam === 'function') return styleParam;
    
    // إذا كان ممرراً كنص باسم الدالة (مثال: "styleRent")
    if (typeof styleParam === 'string') {
        // تنظيف النص من "window." لضمان المطابقة البرمجية
        const trimmed = styleParam.trim().replace('window.', '');
        // استخدام الوصول الآمن للكائن window بدلاً من eval
        if (typeof window[trimmed] === 'function') return window[trimmed];
        console.warn(`⚠️ الستايل المسمى [${trimmed}] غير موجود في النطاق العالمي، تم استخدام الافتراضي.`);
    }
    return defaultFallback;
};

// 6. تجميع كافة الطبقات في كائن موحد
window.appLayers = { 
    osmBaseLayer, esriImageryLayer, aerialLayer, noBasemapLayer
};

// أ) توليد طبقات المساعدة آلياً (المناطق والأحواض Z-Index: 5)
if (MAP_CONFIG && MAP_CONFIG.layers && MAP_CONFIG.layers.helper) {
    MAP_CONFIG.layers.helper.forEach(l => {
        // [إضافة]: التحقق من الاستثناءات العالمية لطبقات المساعدة
        if (MAP_CONFIG.globalExclusions && MAP_CONFIG.globalExclusions.includes(l.id)) return;

        const targetStyle = getLayerStyle(l.style, '#ccc');
        window.appLayers[l.id] = createWFSLayer(l.workspace, l.name, l.title, targetStyle, l.maxRes, l.visible !== false, 5);
    });
}

// ب) توليد طبقات العقارات والأراضي آلياً (الأراضي Z-Index: 10، الشقق والعروض Z-Index: 20)
if (MAP_CONFIG && MAP_CONFIG.layers && MAP_CONFIG.layers.realestate) {
    MAP_CONFIG.layers.realestate.forEach(l => {
        // [إضافة]: التحقق من الاستثناءات العالمية لطبقات العقارات (مثل rentLayer)
        if (MAP_CONFIG.globalExclusions && MAP_CONFIG.globalExclusions.includes(l.id)) return;

        let zIndex = 20; 
        if (l.id.includes('land') || l.name.includes('land')) zIndex = 10;
        
        const targetStyle = getLayerStyle(l.style, '#ff5722');
        window.appLayers[l.id] = createWFSLayer(l.workspace, l.name, l.title, targetStyle, l.maxRes || 10, true, zIndex);
    });
}

// ج) توليد كافة طبقات الخدمات الـ 59 آلياً وحقنها في أعلى الخريطة (Z-Index: 30)
if (MAP_CONFIG && MAP_CONFIG.globalExclusions) {
    Object.keys(serviceTranslations).forEach(key => {
        if (MAP_CONFIG.globalExclusions.includes(key)) return;

        const info = serviceTranslations[key];
        const sStyle = (f, r) => window.createStyle(f, r, { 
            emoji: info.icon, 
            labelField: 'name', 
            zoomThresholdForLabel: 0.7 
        });
        window.appLayers[key + 'Layer'] = createWFSLayer('services', key, info.name, sStyle, 1, true, 30); 
        //                                                                              ↑
        //                                                              التحكم بزووم ظهور معالم الخدمات maxResolution
    });
}

// 7. طبقات وأدوات البحث والتمييز الفوري (Z-Index: 1000+)
window.appLayers.searchMarkerLayer = new ol.layer.Vector({ 
    source: new ol.source.Vector(), 
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12, 
            fill: new ol.style.Fill({ color: '#007bff' }), // تحويل لون ماركر تحديد الموقع للأزرق
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 })
        })
    }), 
    zIndex: 1000 
});

window.appLayers.searchResultsHighlightLayer = new ol.layer.Vector({ 
    source: new ol.source.Vector(), 
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10, 
            fill: new ol.style.Fill({ color: '#ffff00' }), // اللون الأصفر للبحث
            stroke: new ol.style.Stroke({ color: '#000000', width: 2 })
        }),
        stroke: new ol.style.Stroke({ color: '#ffff00', width: 4 }),
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.3)' })
    }), 
    zIndex: 1001 
});
