/**
 * نسخة محدثة: أيقونات خدمات مصغرة + ظهور متأخر + خط تسمية كبير وواضح
 */

const serviceIcons = {
    'electrician': '⚡', 'ac_technician': '❄️', 'plumber': '🔧', 'general_maintenance': '🛠️',
    'painter': '🎨', 'carpenter': '🪵', 'blacksmith': '🔨', 'builder': '🧱',
    'house_cleaner': '🧹', 'aluminum_tech': '🪟', 'car_mechanic': '🚗', 'car_electrician': '🔌',
    'tire_tech': '🛞', 'car_wash': '🧼', 'motorcycle_repair': '🏍️', 'taxi_driver': '🚕',
    'delivery_services': '📦', 'tow_truck': '🛻', 'cctv_installer': '📹', 'party_planner': '🎈',
    'zaffa_bands': '🥁', 'music_bands': '🎸', 'photographer': '📸', 'party_rental': '🎪',
    'home_nurse': '🩺', 'masseur': '💆', 'cupping_specialist': '🍵', 'nutritionist': '🥗',
    'truck_driver': '🚛', 'security_firms': '🛡️', 'furniture_buyer': '🛋️', 'gardener': '🌿',
    'pet_care': '🐾', 'clown_entertainer': '🤡'
};

// دالة الستايل العامة المطورة
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

    // تم تثبيت الخط هنا ( bold) ليكون متساوياً للجميع
    let styleOptions = {
        text: new ol.style.Text({
            text: text, 
            font: 'bold 15px Arial, sans-serif', 
            fill: new ol.style.Fill({ color: '#333' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }), 
            overflow: true, 
            offsetY: opts.emoji ? -22 : -25 // ضبط الإزاحة حسب نوع الرمز
        })
    };

    const geomType = feature.getGeometry().getType();

    if (geomType.includes('Point')) {
        if (opts.emoji) {
            // أيقونات خدمات مصغرة (30x30) لتقليل الازدحام
            styleOptions.image = new ol.style.Icon({
                anchor: [0.5, 0.5],
                src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
                    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="30">
                        <circle cx="15" cy="15" r="13" fill="white" stroke="%233f51b5" stroke-width="1.5"/>
                        <text x="50%" y="50%" font-size="16" text-anchor="middle" dy=".35em">${opts.emoji}</text>
                    </svg>`
                ),
                scale: 0.75 // حجم الرمز
            });
        } else if (opts.iconUrl) {
            styleOptions.image = new ol.style.Icon({ anchor: [0, 0], src: opts.iconUrl, scale: opts.iconScale });
        } else {
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

// ستايلات الطبقات العقارية (كما هي بطلبك)
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });
window.styleRent = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 102, 0, 1)', iconUrl: 'icons/rent_icon.png', iconScale: 0.05, labelField: 'area' });
window.styleSale = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(0, 128, 0, 1)', iconUrl: 'icons/sale_icon.png', iconScale: 0.1, labelField: 'area' });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area' });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 10 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 20 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });

// تعريف الطبقات الأساسية
const osmBaseLayer = new ol.layer.Tile({ title: 'OSM', visible: false, type: 'base', source: new ol.source.OSM() });
const esriImageryLayer = new ol.layer.Tile({ title: 'Esri', visible: false, type: 'base', source: new ol.source.XYZ({ url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' }) });
const aerialLayer = new ol.layer.Tile({ title: 'Aerial', visible: true, type: 'base', source: new ol.source.TileWMS({ url: 'http://localhost:8080/geoserver/SurdaAbuQash/wms', params: { 'LAYERS': 'SurdaAbuQash:AerialPhoto_Ramallah', 'CRS': 'EPSG:28191' } }) });
const noBasemapLayer = new ol.layer.Vector({ title: 'None', visible: false, type: 'base', source: new ol.source.Vector() });

const createWFSLayer = (workspace, name, title, style, maxRes = 10, visible = true) => new ol.layer.Vector({
    title, visible, maxResolution: maxRes, style,
    source: new ol.source.Vector({
        format: new ol.format.GeoJSON(),
        url: `http://localhost:8080/geoserver/${workspace}/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${workspace}:${name}&outputFormat=application%2Fjson&srsName=EPSG:28191`,
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

// معالجة طبقات الخدمات
const servicesList = Object.keys(serviceIcons); 
const serviceLayers = {};

servicesList.forEach(s => {
    const sStyle = (f, r) => window.createStyle(f, r, { 
        emoji: serviceIcons[s], 
        labelField: 'name', 
        zoomThresholdForLabel: 0.7 // الاسم يظهر بوضوح عند مستوى زووم متقدم
    });

    // تم تقليل maxResolution لـ 4 لضمان ظهور الخدمات بعد الشقق عند التقريب
    serviceLayers[s + 'Layer'] = createWFSLayer('services', s, s, sStyle, 4, true); 
});

const searchMarkerLayer = new ol.layer.Vector({ source: new ol.source.Vector(), zIndex: 1000, style: new ol.style.Style({ image: new ol.style.Circle({ radius: 8, fill: new ol.style.Fill({ color: '#007bff' }), stroke: new ol.style.Stroke({ color: '#fff', width: 2 }) }) }) });
const searchResultsHighlightLayer = new ol.layer.Vector({ source: new ol.source.Vector(), zIndex: 1001 });

window.appLayers = { 
    osmBaseLayer, esriImageryLayer, aerialLayer, noBasemapLayer, 
    rentLayer, saleLayer, landLayer, locationLayer, cityLayer, governorateLayer, roadsLayer,
    searchMarkerLayer, searchResultsHighlightLayer, ...serviceLayers 
};

window.layerMap = {};
Object.keys(window.appLayers).forEach(key => {
    if (window.appLayers[key].getSource) {
        window.layerMap[key] = window.appLayers[key].getSource();
        window.appLayers[key.replace('Layer', 'Source')] = window.appLayers[key].getSource();
    }
});

// تابع لملف js/layers.js

// دالة لتشغيل لوحة التحكم بالطبقات (Layer Switcher)
window.initializeLayerControl = function(map) {
    const layerPanel = document.getElementById('map-controls'); // أو أي حاوية تريدها
    const toggleBtn = document.getElementById('toggleLayerPanel');
    
    // إنشاء عنصر القائمة إذا لم يكن موجوداً
    let listContainer = document.createElement('div');
    listContainer.id = 'layer-list-container';
    listContainer.className = 'hidden panel-right';
    listContainer.innerHTML = '<h3><i class="fas fa-layer-group"></i> التحكم بالطبقات</h3><hr>';
    document.body.appendChild(listContainer);

    // إضافة زر إغلاق
    let closeBtn = document.createElement('button');
    closeBtn.innerHTML = '❌';
    closeBtn.className = 'close-btn';
    closeBtn.onclick = () => listContainer.classList.add('hidden');
    listContainer.appendChild(closeBtn);

    // تعبئة الطبقات في القائمة
    Object.keys(window.appLayers).forEach(key => {
        const layer = window.appLayers[key];
        const title = layer.get('title');

        if (title && title !== 'None' && !key.includes('search')) {
            const item = document.createElement('div');
            item.className = 'layer-item';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.checked = layer.getVisible();
            checkbox.onchange = (e) => layer.setVisible(e.target.checked);

            const label = document.createElement('label');
            label.textContent = title;

            item.appendChild(checkbox);
            item.appendChild(label);
            listContainer.appendChild(item);
        }
    });

    // ربط الزر بفتح القائمة
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            listContainer.classList.toggle('hidden');
        };
    }
};