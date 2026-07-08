/**
 * main.js - النسخة النهائية المطورة مع نظام الإقلاع الديناميكي الموحد (ستاندرد) وإدارة صلاحيات المشرف ومزود الخدمة
 * تم حل مشكلة تباين الزووم عند النقر على زر الانتقال إلى موقع الخدمة ليصبح زووم 19 فورياً من النقرة الأولى.
 */

if (typeof proj4 !== 'undefined') {
    proj4.defs('EPSG:28191', '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
    ol.proj.proj4.register(proj4);
}

// [إجراء أمني 3]: دالة تطهير النصوص لمنع هجمات XSS
window.sanitizeHTML = function(str) {
    if (!str) return "";
    const temp = document.createElement('div');
    temp.textContent = str;
    return temp.innerHTML;
};

// تعريف كائنات الطبقات في النطاق العالمي لضمان الوصول إليها من أي ملف
window.overlayLayersObj = {}; 

window.ensureSecureGeolocationContext = function() {
    const isLocalhost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
    const isSecure = window.isSecureContext || window.location.protocol === 'https:' || isLocalhost;

    if (isSecure) {
        return { allowed: true };
    }

    return {
        allowed: false,
        message: 'لا يمكن استخدام GPS من هذا الرابط لأن الموقع يعمل عبر HTTP. يرجى فتحه عبر HTTPS أو من localhost ثم منح الإذن للموقع.'
    };
};

window.getGeolocationErrorMessage = function(error) {
    const secureCheck = window.ensureSecureGeolocationContext();
    if (!secureCheck.allowed) {
        return secureCheck.message;
    }

    switch (error && error.code) {
        case 1:
            return 'تم رفض صلاحية الوصول إلى الموقع. يرجى منح إذن الموقع للمتصفح والمحاولة مرة أخرى.';
        case 2:
            return 'تعذر تحديد موقعك الحالي. تأكد من تشغيل GPS وإعطاء الصلاحية.';
        case 3:
            return 'انتهت مهلة محاولة تحديد موقعك. حاول مرة أخرى.';
        default:
            return 'فشل الوصول للموقع. تأكد من تفعيل GPS ومنح الإذن للموقع.';
    }
};

window.requestGeolocationPosition = function(onSuccess, onError, options = {}) {
    const opts = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options
    };

    if (!navigator.geolocation) {
        const error = { code: 2, message: 'المتصفح لا يدعم GPS.' };
        if (typeof onError === 'function') onError(error);
        return;
    }

    const secureCheck = window.ensureSecureGeolocationContext();
    if (!secureCheck.allowed) {
        const error = { code: 1, message: secureCheck.message };
        if (typeof onError === 'function') onError(error);
        return;
    }

    navigator.geolocation.getCurrentPosition(
        (position) => {
            if (typeof onSuccess === 'function') onSuccess(position);
        },
        (error) => {
            const wrappedError = {
                ...error,
                message: window.getGeolocationErrorMessage(error)
            };
            if (typeof onError === 'function') onError(wrappedError);
        },
        opts
    );
};

window.watchGeolocationPosition = function(onSuccess, onError, options = {}) {
    const opts = {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
        ...options
    };

    if (!navigator.geolocation) {
        const error = { code: 2, message: 'المتصفح لا يدعم GPS.' };
        if (typeof onError === 'function') onError(error);
        return null;
    }

    const secureCheck = window.ensureSecureGeolocationContext();
    if (!secureCheck.allowed) {
        const error = { code: 1, message: secureCheck.message };
        if (typeof onError === 'function') onError(error);
        return null;
    }

    return navigator.geolocation.watchPosition(
        (position) => {
            if (typeof onSuccess === 'function') onSuccess(position);
        },
        (error) => {
            const wrappedError = {
                ...error,
                message: window.getGeolocationErrorMessage(error)
            };
            if (typeof onError === 'function') onError(wrappedError);
        },
        opts
    );
};

// إنشاء طبقة التمييز الصفراء لتكون جاهزة دائماً
window.searchResultsHighlightLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 10,
            fill: new ol.style.Fill({ color: '#ffff00' }), // اللون الأصفر لنتائج البحث
            stroke: new ol.style.Stroke({ color: '#000000', width: 2 })
        }),
        stroke: new ol.style.Stroke({ color: '#ffff00', width: 4 }),
        fill: new ol.style.Fill({ color: 'rgba(255, 255, 0, 0.3)' })
    }),
    zIndex: 2000 // جعلها فوق كل الطبقات
});

// طبقة مخصصة للانتقال إلى موقع الخدمة (اللون الأحمر المميز)
window.providerFlyToLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 12,
            fill: new ol.style.Fill({ color: '#ff0000' }), // اللون الأحمر للانتقال للموقع
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 })
        }),
        zIndex: 2005
    }),
    zIndex: 2005
});

// طبقة مخصصة لعرض موقع المستخدم الحالي بشكل حي (نقطة زرقاء احترافية لتتبع الحركة)
window.userLiveLocationLayer = new ol.layer.Vector({
    source: new ol.source.Vector(),
    style: new ol.style.Style({
        image: new ol.style.Circle({
            radius: 9,
            fill: new ol.style.Fill({ color: '#3399CC' }), // لون أزرق ملاحة احترافي
            stroke: new ol.style.Stroke({ color: '#ffffff', width: 3 }) // إطار أبيض لتبرز فوق الصورة الجوية
        }),
        zIndex: 2001
    }),
    zIndex: 2001
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
                // استخدام الإعدادات من layers.js بدلاً من فرض aerialLayer
                lyr.setVisible(lyr.getVisible());
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
    mapLayersArray.push(window.providerFlyToLayer);
    mapLayersArray.push(window.userLiveLocationLayer);

    // الإحداثيات الافتراضية للموقع الرئيسي للمنصة (المركز والزووم الافتراضي)
    let defaultCenter = [169463.41, 145767.99];
    let defaultZoom = 19;

    // --- [تطوير ديناميكي]: كائن المدن الموحد لتسهيل الإضافة المباشرة مستقبلاً ---
    const citiesCoordinates = {
        'ramallah': { name: '3. الانتقال مباشرة إلى بلدية رام الله', coords: [168986.922, 145468.480] },
        'albiereh': { name: '4. الانتقال مباشرة إلى بلدية البيرة', coords: [170185.605, 145713.553] },
        'beitunia': { name: '5. الانتقال مباشرة إلى بلدية بيتونيا', coords: [165995.512, 144049.217] }
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

    // متغيرات تتبع الموقع الحي والمستمر
    window.userLocationWatchId = null;
    let lastUpdateTime = 0;

    // دالة موحدة لتتبع الموقع الجغرافي بشكل حي ومستمر (مثالية لمن هو في سيارة لتتبع المسار)
    const getUserCurrentLocation = (targetButton) => {
        // إذا كان نظام التتبع يعمل مسبقاً، نقوم بإيقافه فوراً (Toggle)
        if (window.userLocationWatchId !== null) {
            navigator.geolocation.clearWatch(window.userLocationWatchId);
            window.userLocationWatchId = null;
            window.userLiveLocationLayer.getSource().clear();
            if (targetButton) {
                targetButton.innerHTML = '🎯';
                targetButton.style.setProperty("background-color", "rgba(0, 60, 136, 0.85)", "important");
            }
            return;
        }

        if (targetButton) {
            targetButton.innerHTML = '⏳';
            targetButton.style.setProperty("background-color", "#2ecc71", "important");
        }

        window.userLocationWatchId = window.watchGeolocationPosition(
            (position) => {
                const currentTime = Date.now();
                console.log("📍 تم استلام إحداثيات GPS جديدة بدقة:", position.coords.accuracy);

                if (currentTime - lastUpdateTime < 10000) return;
                
                lastUpdateTime = currentTime;
                const transformedCoords = proj4('EPSG:4326', 'EPSG:28191', [position.coords.longitude, position.coords.latitude]);

                const source = window.userLiveLocationLayer.getSource();
                source.clear();
                const feature = new ol.Feature({
                    geometry: new ol.geom.Point(transformedCoords)
                });
                source.addFeature(feature);

                map.getView().animate({
                    center: transformedCoords,
                    zoom: map.getView().getZoom() < 17 ? 18 : map.getView().getZoom(),
                    duration: 1500
                });

                if (targetButton) targetButton.innerHTML = '📡';
            },
            (error) => {
                console.error("Geolocation Tracking Error:", error);
                if (targetButton) {
                    targetButton.innerHTML = '🎯';
                    targetButton.style.setProperty("background-color", "rgba(0, 60, 136, 0.85)", "important");
                }
                if (window.userLocationWatchId !== null) {
                    navigator.geolocation.clearWatch(window.userLocationWatchId);
                }
                window.userLocationWatchId = null;
                alert(window.getGeolocationErrorMessage(error));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    };

    // --- 3. بناء واجهة الاختيار المطور وحقن زر الموقع والنافذة المنبثقة لإقلاع الخريطة ---
    setTimeout(() => {
        const zoomContainer = document.querySelector('.ol-zoom');
        if (zoomContainer) {
            // تحقق لمنع تكرار حقن الزر
            if (!document.querySelector('.ol-custom-location-btn')) {
                const locationBtn = document.createElement('button');
                locationBtn.className = 'ol-custom-location-btn';
                locationBtn.setAttribute('type', 'button');
                locationBtn.setAttribute('title', 'تحديد موقعي الحالي');
                locationBtn.innerHTML = '🎯'; 
                
                zoomContainer.appendChild(locationBtn);

                locationBtn.onclick = () => {
                    getUserCurrentLocation(locationBtn);
                };
            }

            // تحقق لمنع تكرار حقن النافذة
            if (!document.getElementById('custom-splash-overlay')) {
                const splashOverlay = document.createElement('div');
                splashOverlay.id = 'custom-splash-overlay';
                // تم إسناد الخصائص الأساسية برمجياً مع ترك التحكم المرن للـ CSS
                Object.assign(splashOverlay.style, {
                    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
                    backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: '200000',
                    display: 'flex', justifyContent: 'center', direction: 'rtl', padding: '15px', boxSizing: 'border-box'
                });

                const dialogBox = document.createElement('div');
                dialogBox.id = 'custom-splash-dialog';

                dialogBox.innerHTML = `
                    <h3 style="margin-top:0; color:#2c3e50; font-size:18px; margin-bottom:2px; font-weight:700;">منصة الخرائط الجغرافية</h3>
                    <p style="color:#7f8c8d; font-size:13px; margin-bottom:20px;">الرجاء اختيار نطاق التركيز الأولي لبدء استكشاف الخريطة:</p>
                    <div id="splash-options-container" style="display:flex; flex-direction:column; gap:10px;">
                        <button class="splash-opt-btn" data-type="default" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">1. العرض الافتراضي للمنصة</button>
                        <button class="splash-opt-btn" data-type="gps" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">2. تحديد النطاق حسب موقعي الحالي (GPS)</button>
                    </div>
                `;

                const optionsContainer = dialogBox.querySelector('#splash-options-container');
                if (typeof citiesCoordinates !== 'undefined') {
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
                }

                splashOverlay.appendChild(dialogBox);
                document.body.appendChild(splashOverlay);

                dialogBox.querySelectorAll('.splash-opt-btn').forEach(btn => {
                    btn.addEventListener('click', function() {
                        const type = this.getAttribute('data-type');
                        const locationBtnEl = document.querySelector('.ol-custom-location-btn');
                        
                        if (type === 'default') {
                            splashOverlay.remove();
                        } 
                        else if (type === 'gps') {
                            splashOverlay.remove();
                            getUserCurrentLocation(locationBtnEl);
                        } 
                        else if (type === 'city') {
                            const cityName = this.getAttribute('data-city');
                            const cityData = citiesCoordinates[cityName];
                            if (cityData && cityData.coords) {
                                map.getView().animate({
                                    center: cityData.coords,
                                    zoom: 19,
                                    duration: 1000
                                });
                            }
                            splashOverlay.remove();
                        }
                    });

                    btn.addEventListener('mouseover', function() { this.style.background = '#34495e'; });
                    btn.addEventListener('mouseout', function() { this.style.background = '#2c3e50'; });
                });
            }
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

    // --- 5. محرك اللوحات الموحد والمعدل للصلاحيات ---
    window.closeAllPanels = () => {
        document.querySelectorAll('.panel-right').forEach(p => {
            // استثناء لوحة مزود الخدمة من الإغلاق
            if (p.id !== 'provider-mini-panel') {
                p.classList.add('hidden');
                // تأمين الإغلاق وإلغاء القفل الخاص بـ display الحماية للمشرف
                p.style.removeProperty("display");
            }
        });

        if (window.searchResultsHighlightLayer) window.searchResultsHighlightLayer.getSource().clear();

        // تعطيل كافة الأدوات الوظيفية لتجنب التعارض
        if (typeof window.toggleShareLocationTool === 'function') window.toggleShareLocationTool(false);
        if (typeof window.deactivatePointEditTools === 'function') window.deactivatePointEditTools();
        if (typeof window.deactivatePolygonEditTools === 'function') window.deactivatePolygonEditTools();
        if (typeof window.deactivateLineEditTools === 'function') window.deactivateLineEditTools();
    };

    // الربط الذكي الموحد للأزرار (تم التخلص من التكرار القديم وحل مشكلة العرض للمشرف)
    document.querySelectorAll('[data-panel]').forEach(btn => {
        btn.onclick = function() {
            const panelId = this.getAttribute('data-panel');
            const editType = this.getAttribute('data-edit-type');
            const panel = document.getElementById(panelId);
            
            if (!panel) return;

            const isCurrentlyHidden = panel.classList.contains('hidden');
            
            window.closeAllPanels();

            if (isCurrentlyHidden) {
                // الفحص الآمن لدور المستخدم لتفادي انقطاع الكود إذا لم يكن معرّفاً
                const currentRole = window.currentUserRole || (typeof currentUserRole !== 'undefined' ? currentUserRole : null);
                if (currentRole === 'admin') {
                    panel.style.setProperty("display", "block", "important");
                }

                panel.classList.remove('hidden');
                populateEditSelects();

                // تفعيل أدوات التحرير الجغرافية حسب نوع الزر المنقور
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

                // معالجة لوحات مخصصة عند الفتح
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

    // زر القائمة العلوية للهواتف المحمولة
    const topToggle = document.getElementById('toggle-top-buttons-btn');
    if (topToggle) {
        topToggle.onclick = () => {
            const container = document.getElementById('top-buttons-container');
            if (container) container.classList.toggle('hidden-buttons-container');
        };
    }

    // --- 7. تهيئة الأدوات العامة عند تحميل الصفحة ---
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
        
        // [محرك المزامنة التلقائية]: تحديث ذكي كل 15 ثانية لضمان رؤية التغييرات دون إرهاق السيرفر
        
    }, 1000);

    /**
     * دالة المزامنة الذكية: تقوم بتحديث الطبقات الظاهرة فقط لتوفير موارد السيرفر
     */
    function startSmartMapSync(interval) {
        setInterval(() => {
            if (!window.overlayLayersObj) return;

            const layersToUpdate = [];

            Object.keys(window.overlayLayersObj).forEach(key => {
                const layer = window.overlayLayersObj[key];
                const lowerKey = key.toLowerCase();

                // استثناء الطبقات الداخلية من التحديث
                const isInternalLayer = lowerKey.includes('highlight') || 
                                        lowerKey.includes('marker') || 
                                        lowerKey.includes('live') || 
                                        lowerKey.includes('fly') ||
                                        lowerKey.includes('share');

                // جمع الطبقات المرشحة للتحديث فقط
                if (layer && layer.getVisible() && !isInternalLayer && 
                    (lowerKey.includes('layer') || lowerKey.includes('rent') || lowerKey.includes('sale'))) {
                    layersToUpdate.push(layer);
                }
            });

            // تحديث كل طبقة بتأخير ثانيتين عن السابقة لمنع الاختفاء الجماعي
            layersToUpdate.forEach((layer, index) => {
                setTimeout(() => {
                    const source = layer.getSource();
                    if (source && typeof source.refresh === 'function') {
                        source.refresh();
                    }
                }, index * 2000);
            });

        }, interval);
    }

    // متابعة الإحداثيات وطباعتها في شريط المعلومات السفلي
    map.on('pointermove', (e) => {
        const el = document.getElementById('palestineCoords');
        if (el && e.coordinate) {
            el.innerText = `E: ${e.coordinate[0].toFixed(2)}, N: ${e.coordinate[1].toFixed(2)}`;
        }
    });

    // تبديل خرائط الأساس الديناميكي
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
