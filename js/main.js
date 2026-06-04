/**
 * main.js - النسخة النهائية المطورة مع نظام الإقلاع الديناميكي الموحد (ستاندرد)
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

    // الإحداثيات الافتراضية للموقع الرئيسي للمنصة (المركز والزووم الافتراضي)
    let defaultCenter = [169463.41, 145767.99];
    let defaultZoom = 19;

    // --- [تطوير ديناميكي]: كائن المدن الموحد لتسهيل الإضافة المباشرة مستقبلاً ---
    const citiesCoordinates = {
        'ramallah': { name: '3. الانتقال مباشرة إلى بلدية رام الله', coords: [168986.922, 145468.480] },
        'albiereh': { name: '4. الانتقال مباشرة إلى بلدية البيرة', coords: [170185.605, 145713.553] },
        'beitunia': { name: '5. الانتقال مباشرة إلى بلدية بيتونيا', coords: [165995.512, 144049.217] }
        // لمستقبل التوسعة، أضف السطر هنا فقط بنفس التنسيق تماماً دون تعديل الـ HTML
    };

    // --- 2. إنشاء الخريطة ---
    const map = new ol.Map({
        target: 'map',
        layers: mapLayersArray,
        view: new ol.View({
            projection: 'EPSG:28191',
            center: defaultCenter,
            zoom: defaultZoom
        })
    });
    window.map = map;

    // دالة موحدة لجلب الموقع الجغرافي الحالي وتحريك الخريطة
    const getUserCurrentLocation = (targetButton) => {
        if (!navigator.geolocation) {
            alert('ميزة تحديد الموقع غير مدعومة في متصفحك الحالي.');
            return;
        }

        if (targetButton) targetButton.innerHTML = '⏳'; // تغيير الأيقونة مؤقتاً أثناء التحميل
        
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;

                // تحويل الإحداثيات الجغرافية العالمية WGS84 إلى النظام الفلسطيني المعتمد EPSG:28191
                const transformedCoords = proj4('EPSG:4326', 'EPSG:28191', [lon, lat]);

                // تحريك الخريطة بسلاسة للموقع الجديد وزيادة الزووم
                map.getView().animate({
                    center: transformedCoords,
                    zoom: 19,
                    duration: 1200
                });

                if (targetButton) targetButton.innerHTML = '🎯'; // إعادة الأيقونة الأصلية
            },
            (error) => {
                if (targetButton) targetButton.innerHTML = '🎯';
                switch(error.code) {
                    case error.PERMISSION_DENIED:
                        alert('تم رفض طلب الوصول إلى الموقع الجغرافي. يرجى تفعيل الصلاحية من إعدادات المتصفح.');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        alert('معلومات الموقع الجغرافي غير متوفرة حالياً.');
                        break;
                    case error.TIMEOUT:
                        alert('انتهت مهلة طلب جلب الموقع الحالي.');
                        break;
                    default:
                        alert('حدث خطأ غير معروف أثناء تحديد الموقع.');
                }
            },
            {
                enableHighAccuracy: true, // طلب دقة عالية عبر الـ GPS للموبايل
                timeout: 10000,
                maximumAge: 0
            }
        );
    };

    // --- 3. بناء واجهة الاختيار المطور وحقن زر الموقع والنافذة المنبثقة لإقلاع الخريطة ---
    setTimeout(() => {
        const zoomContainer = document.querySelector('.ol-zoom');
        if (zoomContainer) {
            // إنشاء زر تحديد الموقع اليدوي الافتراضي وحقنه في الخريطة
            const locationBtn = document.createElement('button');
            locationBtn.className = 'ol-custom-location-btn';
            locationBtn.setAttribute('type', 'button');
            locationBtn.setAttribute('title', 'تحديد موقعي الحالي');
            locationBtn.innerHTML = '🎯'; 
            
            zoomContainer.appendChild(locationBtn);

            // تفعيل وظيفة جلب الموقع عند الضغط اليدوي على الزر
            locationBtn.onclick = () => {
                getUserCurrentLocation(locationBtn);
            };

            // إنشاء شاشة الترحيب القياسية وخيارات الإقلاع بنمط ستاندرد موحد
            const splashOverlay = document.createElement('div');
            splashOverlay.id = 'custom-splash-overlay';
            Object.assign(splashOverlay.style, {
                position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: '99999',
                display: 'flex', justifyContent: 'center', alignItems: 'center',
                direction: 'rtl', padding: '15px', boxSizing: 'border-box'
            });

            const dialogBox = document.createElement('div');
            dialogBox.id = 'custom-splash-dialog';
            Object.assign(dialogBox.style, {
                backgroundColor: '#ffffff', padding: '25px', borderRadius: '8px',
                width: '100%', maxWidth: '420px', boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                textAlign: 'center', fontFamily: 'system-ui, sans-serif'
            });

            // ترويسة النافذة المنبثقة الاستاتيكية
            dialogBox.innerHTML = `
                <h3 style="margin-top:0; color:#2c3e50; font-size:18px; margin-bottom:6px; font-weight:700;">منصة الخرائط الجغرافية</h3>
                <p style="color:#7f8c8d; font-size:13px; margin-bottom:20px;">الرجاء اختيار نطاق التركيز الأولي لبدء استكشاف الخريطة:</p>
                <div id="splash-options-container" style="display:flex; flex-direction:column; gap:10px;">
                    <button class="splash-opt-btn" data-type="default" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">1. العرض الافتراضي للمنصة</button>
                    <button class="splash-opt-btn" data-type="gps" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">2. تحديد النطاق حسب موقعي الحالي (GPS)</button>
                </div>
            `;

            // حقن الأزرار ديناميكياً داخل حاوية النافذة من كائن المدن لضمان مظهر موحد وسهولة التعديل
            const optionsContainer = dialogBox.querySelector('#splash-options-container');
            Object.keys(citiesCoordinates).forEach(key => {
                const cityBtn = document.createElement('button');
                cityBtn.className = 'splash-opt-btn';
                cityBtn.setAttribute('data-type', 'city');
                cityBtn.setAttribute('data-city', key);
                cityBtn.innerText = citiesCoordinates[key].name;
                Object.assign(cityBtn.style, {
                    padding: '12px', fontSize: '14px', background: '#2c3e50', color: 'white',
                    border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: '500',
                    textAlign: 'right', transition: 'background 0.2s'
                });
                optionsContainer.appendChild(cityBtn);
            });

            splashOverlay.appendChild(dialogBox);
            document.body.appendChild(splashOverlay);

            // تفعيل أحداث النقر الموحدة داخل أزرار شاشة الاختيار القياسية
            dialogBox.querySelectorAll('.splash-opt-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const type = this.getAttribute('data-type');
                    
                    if (type === 'default') {
                        // الخيار الأول: الإبقاء على المركز والزووم الافتراضي دون تعديل
                        document.body.removeChild(splashOverlay);
                    } 
                    else if (type === 'gps') {
                        // الخيار الثاني: تشغيل محرك الجيولكيشن والاتصال بالموقع
                        document.body.removeChild(splashOverlay);
                        getUserCurrentLocation(locationBtn);
                    } 
                    else if (type === 'city') {
                        // الخيارات المتبقية: سحب الإحداثيات من الكائن وعمل الأنيميشن للمدينة المختارة
                        const cityName = this.getAttribute('data-city');
                        const cityData = citiesCoordinates[cityName];
                        if (cityData && cityData.coords) {
                            map.getView().animate({
                                center: cityData.coords,
                                zoom: 19,
                                duration: 1000
                            });
                        }
                        document.body.removeChild(splashOverlay);
                    }
                });

                // تأثيرات التمرير القياسية (Hover Effect) لتغيير درجة لون الزر الأزرق
                btn.addEventListener('mouseover', function() { this.style.background = '#34495e'; });
                btn.addEventListener('mouseout', function() { this.style.background = '#2c3e50'; });
            });
        }
    }, 1000); 

    // --- 4. إدارة تعبئة قوائم التحرير ---
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

    // --- 5. محرك اللوحات الموحد ---
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
                    if (editType === 'point' && typeof initializeEditTools === 'function') {
                        initializeEditTools(window.map, window.overlayLayersObj);
                    } 
                    else if (editType === 'polygon' && typeof initializePolygonEditTools === 'function') {
                        initializePolygonEditTools(window.map, window.overlayLayersObj);
                    } 
                    else if (editType === 'line' && typeof window.initializeLineEditTools === 'function') {
                        window.initializeLineEditTools(window.map, window.overlayLayersObj);
                    }
                }
            }
        };
    });

    // الربط التكراري الموثق للأزرار
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

    // --- 6. تهيئة الأدوات العامة ---
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

    // متابعة الإحداثيات وطباعتها في شريط المعلومات السفلي
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