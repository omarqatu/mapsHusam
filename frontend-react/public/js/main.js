/**
 * main.js
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

// 🆕 حارس منع الاستدعاء المزدوج (initMapPlatform يجب أن ينفذ مرة واحدة فقط)
window.__mapPlatformInitialized = window.__mapPlatformInitialized || false;

// 🆕 كامل منطق تهيئة الخريطة أصبح دالة عامة تُستدعى صراحة من enterPlatform()
// بعد إظهار #app-shell، وليس تلقائياً عند تحميل الصفحة.
window.initMapPlatform = function () {
    // ربط وظيفة زر البحث بدون خريطة
    const noMapBtn = document.getElementById('no-map-search-btn');
        if (noMapBtn) {
            noMapBtn.addEventListener('click', () => {
                window.location.href = '/no-map-search.html';
            });
        }
    
    const layers = window.appLayers || {};
    const baseKeys = ['aerialLayer', 'osmBaseLayer', 'esriImageryLayer', 'noBasemapLayer'];
    const mapLayersArray = [];

    // ضمان أن طبقات التمييز والحركة الحية تم تضمينها في object التطبيق العام
    if (window.appLayers) {
        window.appLayers.searchResultsHighlightLayer = window.searchResultsHighlightLayer;
        window.appLayers.providerFlyToLayer = window.providerFlyToLayer;
        window.appLayers.userLiveLocationLayer = window.userLiveLocationLayer;
    }

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

                if (isRoad) lyr.setVisible(true);
                else if (isInternalSearch) lyr.setVisible(true);
                else lyr.setVisible(true);

                // تخزين الطبقات في الكائن العالمي
                window.overlayLayersObj[key] = lyr;
            }
            mapLayersArray.push(lyr);
        }
    });

    // الإحداثيات الافتراضية للموقع الرئيسي للمنصة (المركز والزووم الافتراضي)
    let defaultCenter = [169463.41, 145767.99];
    let defaultZoom = 19;

    // --- [تطوير ديناميكي]: كائن المدن الموحد لتسهيل الإضافة المباشرة مستقبلاً ---
    const citiesCoordinates = {
        'ramallah': { name: '3. الانتقال مباشرة إلى مدينة رام الله', coords: [168986.922, 145468.480] },
        'albiereh': { name: '4. الانتقال مباشرة مدينة إلى البيرة', coords: [170185.605, 145713.553] },
        'beitunia': { name: '5. الانتقال مباشرة مدينة إلى بيتونيا', coords: [165995.512, 144049.217] }
    };

    // --- 2. إنشاء الخريطة مع تحسينات الأداء ---
    const map = new ol.Map({
        target: 'map',
        layers: mapLayersArray,
        view: new ol.View({
            projection: 'EPSG:28191',
            center: defaultCenter,
            zoom: defaultZoom,
            // تحسينات الأداء للعرض
            minZoom: 1,
            maxZoom: 22,
            constrainResolution: true, // تحسين الأداء بتقييد مستويات الزووم
            smoothResolutionConstraint: true, // تحسين جودة العرض
            enableRotation: false // تعطيل الدوران لتحسين الأداء
        }),
        // تحسينات الأداء العامة
        loadTilesWhileAnimating: false, // تحسين الأداء أثناء الحركة
        loadTilesWhileInteracting: false, // تحسين الأداء أثناء التفاعل
        pixelRatio: Math.min(window.devicePixelRatio, 2) // تحسين الأداء بتقييد pixel ratio
    });
    window.map = map;

    // 🆕 التأكد من أن الخريطة تأخذ الأبعاد الصحيحة بعد ظهور #app-shell فعلياً
    requestAnimationFrame(() => map.updateSize());

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
                    duration: 500
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
        if (!document.querySelector('.ol-custom-location-btn')) {
            const locationBtn = document.createElement('button');
            locationBtn.className = 'ol-custom-location-btn';
            locationBtn.setAttribute('type', 'button');
            locationBtn.setAttribute('title', 'تحديد موقعي الحالي');
            locationBtn.innerHTML = '🎯';
            zoomContainer.appendChild(locationBtn);
            locationBtn.onclick = () => { getUserCurrentLocation(locationBtn); };
        }
    }

    const urlParams = new URLSearchParams(window.location.search);
    const xParam = urlParams.get('x');
    const yParam = urlParams.get('y');
    const resultsShareParam = urlParams.get('resultsShare'); // 🆕

    if (xParam && yParam) {
        document.getElementById('map').style.opacity = '1'; // إظهار الخريطة
        map.getView().animate({ center: [parseFloat(xParam), parseFloat(yParam)], zoom: 19, duration: 1000 });
        return;
    }

    // 🆕 رابط نتيجة بحث مُشارك: أظهر الخريطة مباشرة بدون شاشة اختيار الموقع
    // الافتراضي/GPS، لأن results-share.js هو من سيتولى تنفيذ البحث وتحديد
    // موقع التركيز تلقائياً حسب نتيجة البحث المُعاد تشغيلها
    if (resultsShareParam) {
        document.getElementById('map').style.opacity = '1';
        return;
    }

    if (!document.getElementById('custom-splash-overlay')) {
        const splashOverlay = document.createElement('div');
        splashOverlay.id = 'custom-splash-overlay';
        Object.assign(splashOverlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.55)', zIndex: '200000',
            display: 'flex', justifyContent: 'center', alignItems: 'center', direction: 'rtl', padding: '15px', boxSizing: 'border-box'
        });

        const dialogBox = document.createElement('div');
        dialogBox.id = 'custom-splash-dialog';
        dialogBox.style.cssText = "background: #fff; padding: 25px; border-radius: 16px; max-width: 450px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: 1px solid #e0e0e0;";

        dialogBox.innerHTML = `
            <div style="font-family: sans-serif; color: #2c3e50;">
                <h3 style="margin-top:0; margin-bottom:15px; font-size:20px; font-weight:700; text-align:center;">منصة خريطة الخدمات الفلسطينية</h3>
                <p style="margin-bottom:20px; color:#1a5276; font-size:13px; text-align:center; font-weight:600; background:#f0f7ff; padding:12px; border-radius:8px; border: 1px solid #d1e7ff;">
                    ✨ النسخة التجريبية - و لإعادة ترتيب الواجهات واللوحات قم بتحديث المتصفح (يمكن تصغير/تكبير او تحريك أي لوحة او قائمة).
                </p>
                <p style="font-size: 14px; text-align: center; font-weight: 600; margin-bottom: 15px; line-height: 1.6;">
                    إذا تفضل البحث عن أي خدمة بدون خريطة ومن خلال الفلاتر أو كتابة أي كلمة دلالية بمربع البحث مثل شقة بيع، كهربائي، استاذ خصوصي اضغط هنا للانتقال إلى صفحة البحث بدون خريطة
                </p>
                <div style="text-align: center; margin-bottom: 20px;">
                    <a href="/no-map-search.html" id="no-map-link" style="display: inline-block; padding: 12px 25px; background: #27ae60; color: #ffffff; border-radius: 6px; font-weight: 700; text-decoration: none; font-size: 14px;">⇽ الانتقال إلى صفحة البحث بدون خريطة</a>
                </div>
                <p style="font-size: 14px; text-align: center; font-weight: 600; margin-bottom: 15px; line-height: 1.6;">
                    أما إذا بدك خريطة اختار تفتح موقع افتراضي ميدان المنارة وسط مدينتي رام الله والبيرة أو موقعك الجغرافي
                </p>
                <div id="splash-options-container" style="display:flex; flex-direction:column; gap:10px;">
                    <button class="splash-opt-btn" data-type="default" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">📍 فتح موقع افتراضي (ميدان المنارة - رام الله والبيرة)</button>
                    <button class="splash-opt-btn" data-type="gps" style="padding:12px; font-size:14px; background:#2c3e50; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:500; text-align:right; transition:background 0.2s;">🎯 فتح موقعي الجغرافي (انتظر قليلاً لتحديد موقعك بدقة)</button>
                </div>
                <p style="font-size: 13px; text-align: center; font-weight: 600; margin-top: 20px; color: #1a5276; background: #f0f7ff; padding: 12px; border-radius: 8px; border: 1px solid #d1e7ff; line-height: 1.6;">
                    💡 ملاحظة: يمكن الانتقال بين الصفحتين بكل سهولة ويمكن الانتقال إلى أي خدمة لموقعها ومشاركة أي موقع
                </p>
            </div>
        `;


        splashOverlay.appendChild(dialogBox);
        document.body.appendChild(splashOverlay);

        dialogBox.querySelectorAll('.splash-opt-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const type = this.getAttribute('data-type');
                const locationBtnEl = document.querySelector('.ol-custom-location-btn');
                
                // إظهار الخريطة عند الاختيار
                document.getElementById('map').style.opacity = '1';
                splashOverlay.remove();

                if (type === 'gps') { getUserCurrentLocation(locationBtnEl); } 
                else if (type === 'city') {
                    const cityData = citiesCoordinates[this.getAttribute('data-city')];
                    if (cityData) map.getView().animate({ center: cityData.coords, zoom: 19, duration: 1000 });
                }
            });
        });
    }
}, 100);

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
    window.closeAllPanels = (exceptIds = []) => {
    document.querySelectorAll('.panel-right').forEach(p => {
        if (p.id !== 'provider-mini-panel' && !exceptIds.includes(p.id)) {
            p.classList.add('hidden');
            p.style.removeProperty("display");
        }
    });

    if (window.searchResultsHighlightLayer) window.searchResultsHighlightLayer.getSource().clear();

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

            // 🆕 لوحتا "البحث الذكي" و"البحث من خلال الموقع" أصبحتا مستقلتين عن
            // بعضهما تماماً (يمكن فتحهما معاً لأنهما مرصوفتان فوق بعض)، فلا
            // نغلق إحداهما عند فتح الأخرى، ولا نغلق أي منهما عند فتح لوحة أخرى
            const isIndependentSearchPanel = (panelId === 'search-panel' || panelId === 'nearby-apartments-panel');

            if (isIndependentSearchPanel) {
                // إغلاق كل اللوحات الأخرى، لكن مع إبقاء البحث الذكي وبحث الموقع كما هما (لا تُغلق إحداهما بسبب الأخرى)
                window.closeAllPanels(['search-panel', 'nearby-apartments-panel']);
            } else {
                window.closeAllPanels();
            }

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
            } else {
                // إذا كانت اللوحة مفتوحة، أغلقها
                panel.classList.add('hidden');
            }
        };
    });

    // 🆕 فتح لوحتي "البحث الذكي" و"البحث من خلال الموقع" تلقائياً عند دخول المنصة (كمبيوتر فقط)
    (function autoOpenSearchPanels() {
        const isMobileDevice = window.matchMedia('(max-width: 767px) and (orientation: portrait)').matches ||
                                window.matchMedia('(max-width: 900px) and (orientation: landscape)').matches;
        if (isMobileDevice) return;

        ['search-panel', 'nearby-apartments-panel'].forEach(function (panelId) {
            const panel = document.getElementById(panelId);
            if (!panel || !panel.classList.contains('hidden')) return;

            panel.classList.remove('hidden');
            const currentRole = window.currentUserRole || (typeof currentUserRole !== 'undefined' ? currentUserRole : null);
            if (currentRole === 'admin') {
                panel.style.setProperty("display", "block", "important");
            }
            populateEditSelects();

            if (panelId === 'nearby-apartments-panel' && typeof window.populateSearchLayerSelect === 'function') {
                window.populateSearchLayerSelect();
            }
        });
    })();

    // إغلاق اللوحات عند الضغط على زر X (يبقى القديم احتياطاً لأي عنصر قديم يحمل هذا الكلاس)
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.onclick = () => window.closeAllPanels();
    });

    // 🆕 إغلاق فردي حقيقي لكل لوحة عبر زر (✕) الخاص بها فقط (بدون التأثير على
    // باقي اللوحات المفتوحة) - كانت أزرار panel-close-btn غير مربوطة بأي كود إطلاقاً
    window.closeSinglePanel = function(panel) {
        if (!panel) return;
        panel.classList.add('hidden');
        panel.classList.remove('minimized');
        panel.style.removeProperty('display');
        const minimizeBtn = panel.querySelector('.panel-minimize-btn');
        if (minimizeBtn) minimizeBtn.textContent = '−';

        if (panel.id === 'editPanel' && typeof window.deactivatePointEditTools === 'function') {
            window.deactivatePointEditTools();
        } else if (panel.id === 'polygonEditPanel' && typeof window.deactivatePolygonEditTools === 'function') {
            window.deactivatePolygonEditTools();
        } else if (panel.id === 'lineEditPanel' && typeof window.deactivateLineEditTools === 'function') {
            window.deactivateLineEditTools();
        } else if (panel.id === 'shareLocationPanel' && typeof window.toggleShareLocationTool === 'function') {
            window.toggleShareLocationTool(false);
        }
    };

    document.querySelectorAll('.panel-close-btn').forEach(btn => {
        // لوحة النتائج لها منطق إغلاق خاص مُعرَّف مسبقاً بملف quick-search.js
        // (يشمل تفريغ طبقة التمييز الصفراء)، فلا نستبدله هنا لتفادي التعارض
        if (btn.id === 'close-results-panel') return;
        btn.onclick = (e) => {
            e.preventDefault();
            window.closeSinglePanel(btn.closest('.panel-right'));
        };
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
        
        // 🆕 [محرك المزامنة الذكي]: تحديث المعالم كل دقيقة بدلاً من التحديث المستمر
        // لتجنب الحركة المزعجة للمعالم على الخريطة
        startSmartMapSync(map, 60000);
        
    }, 1000);

    /**
     * دالة المزامنة الذكية: تقوم بتحديث الطبقات الظاهرة فقط، وفقط عند الحاجة
     * الفعلية (حركة خريطة أو مهلة احتياطية طويلة)، لتوفير موارد السيرفر.
     */
    function startSmartMapSync(mapInstanceForSync, fallbackInterval) {
        function refreshVisibleDataLayers() {
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

            // تحديث جميع الطبقات دفعة واحدة بدون تأخير لتجنب الحركة المزعجة
            layersToUpdate.forEach((layer) => {
                const source = layer.getSource();
                if (source && typeof source.refresh === 'function') {
                    source.refresh();
                }
            });
        }

        // تحديث دوري فقط بدون تحديث عند الحركة لتجنب الحركة المزعجة
        setInterval(refreshVisibleDataLayers, fallbackInterval);
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
}; // 🆕 نهاية window.initMapPlatform