/**
 * layers.js - النسخة النهائية المحدثة
 * تشمل: الأيقونات المخصصة للعقارات، الإيموجي للخدمات، والأسماء العربية
 */

const serviceTranslations = {
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
    'tow_truck': { name: 'ونش إنقاذ / سطحة', icon: '🛻' },
    'cctv_installer': { name: 'فني كاميرات مراقبة', icon: '📹' },
    'party_planner': { name: 'منظم حفلات', icon: '🎈' },
    'zaffa_bands': { name: 'فرق زفة', icon: '🥁' },
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
    'clown_entertainer': { name: 'مهرج وعروض أطفال', icon: '🤡' }
};

window.createStyle = function (feature, resolution, options = {}) {
    const opts = { 
        fillColor: null, strokeColor: '#000', strokeWidth: 2, 
        labelField: null, iconUrl: null, iconScale: 0.8, 
        zoomThresholdForLabel: 0.9, emoji: null, ...options 
    };

    let text = '';
    if (opts.labelField && resolution < opts.zoomThresholdForLabel) {
        const val = feature.get(opts.labelField);
        if (val) text = val.toString();
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
        // الأولوية 1: أيقونة خارجية (للعقارات)
        if (opts.iconUrl) {
            styleOptions.image = new ol.style.Icon({
                anchor: [0.5, 0.5],
                src: opts.iconUrl,
                scale: opts.iconScale
            });
        } 
        // الأولوية 2: إيموجي (للخدمات)
        else if (opts.emoji) {
            styleOptions.image = new ol.style.Icon({
                anchor: [0.5, 0.5],
                src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30">
                        <circle cx="15" cy="15" r="13" fill="white" stroke="%233f51b5" stroke-width="1.5"/>
                        <text x="50%" y="50%" font-size="16" text-anchor="middle" dy=".35em">${opts.emoji}</text>
                    </svg>`
                ),
                scale: 0.75
            });
        } 
        // افتراضي: نقطة ملونة
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

// ستايلات الطبقات المخصصة
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });

// تعديل ستايلات العقارات لاستخدام الأيقونات
window.styleRent = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 102, 0, 1)', iconUrl: 'icons/rent_icon.png', iconScale: 0.07, labelField: 'area' });
window.styleSale = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(0, 128, 0, 1)', iconUrl: 'icons/sale_icon.png', iconScale: 0.1, labelField: 'area' });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area' });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 10 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 20 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });

// الطبقات الأساسية
const osmBaseLayer = new ol.layer.Tile({ title: 'OSM', visible: false, type: 'base', source: new ol.source.OSM() });
const esriImageryLayer = new ol.layer.Tile({ title: 'Esri', visible: false, type: 'base', source: new ol.source.XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }) });
const aerialLayer = new ol.layer.Tile({ title: 'Aerial', visible: true, type: 'base', source: new ol.source.TileWMS({ url: '/proxy/geoserver/SurdaAbuQash/wms', params: { 'LAYERS': 'SurdaAbuQash:AerialPhoto_Ramallah', 'CRS': 'EPSG:28191' } }) });
const noBasemapLayer = new ol.layer.Vector({ title: 'None', visible: false, type: 'base', source: new ol.source.Vector() });

const createWFSLayer = (workspace, name, title, style, maxRes = 10, visible = true) => new ol.layer.Vector({
    title, visible, maxResolution: maxRes, style,
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: `/proxy/geoserver/${workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${workspace}:${name}&outputFormat=application%2Fjson&srsName=EPSG:28191`,
        strategy: ol.loadingstrategy.all
    })
});

const rentLayer = createWFSLayer('realestate', 'ApartRent', 'شقق الإيجار', window.styleRent, 10);
const saleLayer = createWFSLayer('realestate', 'ApartSale', 'شقق البيع', window.styleSale, 10);
const landLayer = createWFSLayer('realestate', 'LandSale', 'الأراضي للبيع', window.styleLand, 10);
const locationLayer = createWFSLayer('realestate', 'Location', 'المناطق', window.styleLocation, 20);
const cityLayer = createWFSLayer('realestate', 'City', 'المدن', window.styleCity, 30);
const governorateLayer = createWFSLayer('realestate', 'Governorate', 'المحافظات', window.styleGovernorate, 1000);
const roadsLayer = createWFSLayer('realestate', 'RoadsTest', 'الطرق', window.roadsStyle, 0.7, false);

// إنشاء طبقات الخدمات
const serviceLayers = {};
Object.keys(serviceTranslations).forEach(key => {
    const serviceInfo = serviceTranslations[key];
    const sStyle = (f, r) => window.createStyle(f, r, { 
        emoji: serviceInfo.icon, 
        labelField: 'name', 
        zoomThresholdForLabel: 0.7 
    });
    serviceLayers[key + 'Layer'] = createWFSLayer('services', key, serviceInfo.name, sStyle, 4, true); 
});

// طبقات البحث والتمييز
const searchMarkerLayer = new ol.layer.Vector({ 
    source: new ol.source.Vector(), 
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12, fill: new ol.style.Fill({ color: '#ff0000' }),
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 4 })
        })
    }), 
    zIndex: 1000 
});

const searchResultsHighlightLayer = new ol.layer.Vector({ 
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

window.appLayers = { 
    osmBaseLayer, esriImageryLayer, aerialLayer, noBasemapLayer, 
    rentLayer, saleLayer, landLayer, locationLayer, cityLayer, governorateLayer, roadsLayer,
    searchMarkerLayer, searchResultsHighlightLayer, ...serviceLayers 
};