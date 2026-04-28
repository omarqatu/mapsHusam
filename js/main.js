/**
 * main.js - النسخة النهائية المطورة
 * تدير أدوات التحرير (نقاط، مضلعات، خطوط) بذكاء وتمنع تداخل الأدوات
 */

if (typeof proj4 !== 'undefined') {
    proj4.defs('EPSG:28191', '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
    ol.proj.proj4.register(proj4);
}

// تعريف كائنات الطبقات في النطاق العالمي لضمان الوصول إليها من أي ملف
window.overlayLayersObj = {}; 

// إنشاء طبقة التمييز الصفراء لتكون جاهزة دائماً
window.searchResultsHighlightLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({ color: '#ffff00' }),
            stroke: new ol.style.Stroke({ color: '#333333', width: 2 })
        }),
        stroke: new ol.style.Stroke({ color: '#ffff00', width: 4 }),
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.3)' })
    }),
    zIndex: 2000 // جعلها فوق كل الطبقات
});

document.addEventListener('DOMContentLoaded', () => {
    const layers = window.appLayers || {};
    const baseKeys = ['aerialLayer', 'osmBaseLayer', 'esriImageryLayer', 'noBasemapLayer'];
    const mapLayersArray = [];

    // --- 1. إعداد الطبقات وتصنيفها ---
    Object.keys(layers).forEach(key => {
        const lyr = layers[key];
        if (lyr && lyr instanceof ol.layer.Layer) {
            if (baseKeys.includes(key)) {
                lyr.setVisible(key === 'aerialLayer');
            } else {
                const title = (lyr.get('title') || '').toLowerCase();
                const isRoad = key.toLowerCase().includes('road') || title.includes('طرق') || title.includes('شوارع');
                const isInternalSearch = key.toLowerCase().includes('search') || key.toLowerCase().includes('highlight');

                if (isRoad) lyr.setVisible(false);
                else if (isInternalSearch) lyr.setVisible(true);
                else lyr.setVisible(true);

                // تخزين الطبقات في الكائن العالمي
                window.overlayLayersObj[key] = lyr;
            }
            mapLayersArray.push(lyr);
        }
    });

    // إضافة طبقة التمييز لمصفوفة الطبقات قبل إنشاء الخريطة
    mapLayersArray.push(window.searchResultsHighlightLayer);

    // --- 2. إنشاء الخريطة ---
    const map = new ol.Map({
        target: 'map',
        layers: mapLayersArray,
        view: new ol.View({
            projection: 'EPSG:28191',
            center: [169463.41, 145767.99],
            zoom: 17
        })
    });
    window.map = map;

    // --- 3. إدارة تعبئة قوائم التحرير ---
    const populateEditSelects = () => {
        const selects = ['edit-layer-select', 'polygon-layer-select', 'line-layer-select'];
        selects.forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            el.innerHTML = '<option value="">--- اختر طبقة ---</option>';
            
            if (window.overlayLayersObj) {
                Object.keys(window.overlayLayersObj).forEach(key => {
                    const lyr = window.overlayLayersObj[key];
                    if (key.toLowerCase().includes('search') || key.toLowerCase().includes('highlight')) return;
                    
                    const opt = document.createElement('option');
                    opt.value = key;
                    opt.textContent = lyr.get('title') || key;
                    el.appendChild(opt);
                });
            }
        });
    };

// --- 4. محرك اللوحات الموحد (المعدل لضمان تفعيل الخطوط) ---
    window.closeAllPanels = () => {
        document.querySelectorAll('.panel-right').forEach(p => p.classList.add('hidden'));
        
        if (window.searchResultsHighlightLayer) window.searchResultsHighlightLayer.getSource().clear();

        // تعطيل كافة الأدوات
        if (typeof window.toggleShareLocationTool === 'function') window.toggleShareLocationTool(false);
        if (typeof window.deactivatePointEditTools === 'function') window.deactivatePointEditTools();
        if (typeof window.deactivatePolygonEditTools === 'function') window.deactivatePolygonEditTools();
        if (typeof window.deactivateLineEditTools === 'function') window.deactivateLineEditTools();
    };

    // الربط الذكي للأزرار
    document.querySelectorAll('[data-panel]').forEach(btn => {
        btn.onclick = function() {
            const panelId = this.getAttribute('data-panel');
            const editType = this.getAttribute('data-edit-type');
            const panel = document.getElementById(panelId);
            
            if (!panel) return;

            const isCurrentlyHidden = panel.classList.contains('hidden');
            
            window.closeAllPanels();

            if (isCurrentlyHidden) {
                panel.classList.remove('hidden');
                populateEditSelects();

                if (window.map && window.overlayLayersObj) {
                    // تفعيل أدوات النقاط
                    if (editType === 'point' && typeof initializeEditTools === 'function') {
                        initializeEditTools(window.map, window.overlayLayersObj);
                    } 
                    // تفعيل أدوات المضلعات
                    else if (editType === 'polygon' && typeof initializePolygonEditTools === 'function') {
                        initializePolygonEditTools(window.map, window.overlayLayersObj);
                    } 
                    // تفعيل أدوات الخطوط (هنا التعديل المهم)
                    else if (editType === 'line' && typeof window.initializeLineEditTools === 'function') {
                        window.initializeLineEditTools(window.map, window.overlayLayersObj);
                    }
                }
                // ... باقي الوظائف (مشاركة الموقع، البحث القريب) كما هي
            }
        };
    });

    // الربط الذكي للأزرار
    document.querySelectorAll('[data-panel]').forEach(btn => {
        btn.onclick = function() {
            const panelId = this.getAttribute('data-panel');
            const editType = this.getAttribute('data-edit-type');
            const panel = document.getElementById(panelId);
            
            if (!panel) return;

            const isCurrentlyHidden = panel.classList.contains('hidden');
            
            // إغلاق وتعطيل كل شيء أولاً قبل فتح اللوحة الجديدة
            window.closeAllPanels();

            if (isCurrentlyHidden) {
                panel.classList.remove('hidden');
                
                // تحديث القوائم المنسدلة
                populateEditSelects();

                // تفعيل الأداة المطلوبة بناءً على نوع التحرير المحدد في الزر
                if (window.map && window.overlayLayersObj) {
                    if (editType === 'point' && typeof initializeEditTools === 'function') {
                        initializeEditTools(window.map, window.overlayLayersObj);
                    } 
                    else if (editType === 'polygon' && typeof initializePolygonEditTools === 'function') {
                        initializePolygonEditTools(window.map, window.overlayLayersObj);
                    } 
                    else if (editType === 'line' && typeof initializeLineEditTools === 'function') {
                        initializeLineEditTools(window.map, window.overlayLayersObj);
                    }
                }

                // وظائف إضافية للوحات غير التحرير
                if (panelId === 'shareLocationPanel' && typeof window.toggleShareLocationTool === 'function') {
                    window.toggleShareLocationTool(true);
                }
                if (panelId === 'nearby-apartments-panel' && typeof window.populateSearchLayerSelect === 'function') {
                    window.populateSearchLayerSelect();
                }
            }
        };
    });

    // إغلاق اللوحات عند الضغط على زر X
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => window.closeAllPanels();
    });

    // زر القائمة العلوية
    const topToggle = document.getElementById('toggle-top-buttons-btn');
    if (topToggle) {
        topToggle.onclick = () => {
            const container = document.getElementById('top-buttons-container');
            if (container) container.classList.toggle('hidden-buttons-container');
        };
    }

    // --- 5. تهيئة الأدوات العامة ---
    setTimeout(() => {
        if (typeof initializePopup === 'function') initializePopup(map, window.overlayLayersObj);
        if (typeof initializeSearch === 'function') initializeSearch(map, window.overlayLayersObj);
        if (typeof initializeMeasureTools === 'function') initializeMeasureTools(map);
        if (typeof initializeLayerManager === 'function') initializeLayerManager(map, window.overlayLayersObj);
        if (typeof initializeLocationSearch === 'function') initializeLocationSearch(map, window.overlayLayersObj);
        if (typeof initializeShareLocationTools === 'function') initializeShareLocationTools(map);
        if (typeof initializeQuickSearch === 'function') initializeQuickSearch(map, window.overlayLayersObj);
        
        if (typeof window.initializeGlobalSearch === 'function') {
            window.initializeGlobalSearch(); 
        }
    }, 800);

    // متابعة الإحداثيات
    map.on('pointermove', (e) => {
        const el = document.getElementById('palestineCoords');
        if (el && e.coordinate) {
            el.innerText = `E: ${e.coordinate[0].toFixed(2)}, N: ${e.coordinate[1].toFixed(2)}`;
        }
    });

    // تبديل خرائط الأساس
    const basemapSelect = document.getElementById('basemap-select');
    if (basemapSelect) {
        basemapSelect.onchange = (e) => {
            const mapping = { 
                'aerial': 'aerialLayer', 
                'osm': 'osmBaseLayer', 
                'esri': 'esriImageryLayer', 
                'none': 'noBasemapLayer' 
            };
            baseKeys.forEach(k => { 
                if (layers[k]) layers[k].setVisible(k === mapping[e.target.value]); 
            });
        };
    }
});