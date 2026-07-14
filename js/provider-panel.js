/**
 * js/provider-panel.js
 */
window.liveGpsInterval = null; // للمتغير الجديد
window.providerPanelInitialized = false;
window.providerCheckInterval = null;
window.currentProviderService = null; 
window.isCoolingDown = false; // تتبع فترة الانتظار الإجبارية لمنع التلاعب وكثرة الطلبات
window.isAccountFrozen = false; // تتبع حالة التجميد الإداري للحساب

document.addEventListener("DOMContentLoaded", function() {
    forceUnlockButtons();
    executeProviderInitializationPipeline();
    
    if (!window.providerPanelInitialized) {
        window.providerCheckInterval = setInterval(function() {
            executeProviderInitializationPipeline();
        }, 500);
    }
});

function forceUnlockButtons() {
    // السماح بفك الأزرار دائماً لتحديث الواجهة
    if (window.isAccountFrozen) return;

    const btns = ['btn-prov-available-current', 'btn-prov-available-prev', 'btn-prov-busy', 'btn-prov-fly'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = false;
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.style.cursor = 'pointer';
        }
    });
}

function lockProviderButtons() {
    const btns = ['btn-prov-available-current', 'btn-prov-available-prev', 'btn-prov-busy', 'btn-prov-fly'];
    btns.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.disabled = true;
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            btn.style.cursor = 'not-allowed';
        }
    });
}

document.addEventListener("userLoggedIn", function (e) {
    if (e.detail && (e.detail.role === "provider" || e.detail.account_type === "provider")) {
        if (window.providerCheckInterval) clearInterval(window.providerCheckInterval);
        window.providerPanelInitialized = true;
        const unifiedUser = normalizeUserObject(e.detail);
        initProviderPanelEvents();
        checkProviderStatusAndShowPanel(unifiedUser);
    }
});

function normalizeUserObject(userObj) {
    if (!userObj) return null;
    const layer = userObj.service_layer || userObj.target_layer || userObj.layer_name;
    let featId = userObj.feature_id ?? userObj.target_id ?? userObj.targetId ?? userObj.id ?? userObj.user_id;
                     
    return {
        ...userObj,
        service_layer: layer ? layer.trim() : null,
        feature_id: featId ? parseInt(featId) : null,
        id: featId ? parseInt(featId) : null,
        user_id: userObj.user_id || userObj.id,
        status: userObj.status !== undefined && userObj.status !== null ? parseInt(userObj.status) : 0
    };
}

function executeProviderInitializationPipeline() {
    let rawUser = null;
    try {
        rawUser = JSON.parse(localStorage.getItem('map_user')) || 
                  JSON.parse(sessionStorage.getItem('map_user')) || 
                  JSON.parse(localStorage.getItem('user')) ||
                  JSON.parse(sessionStorage.getItem('user'));
    } catch(e) { console.error("⚠️ خطأ في قراءة الكاش:", e); }

    const panel = document.getElementById("provider-mini-panel");
    if (!panel) return;

    const currentUser = normalizeUserObject(rawUser);
    const isProvider = currentUser && (currentUser.role === "provider" || currentUser.account_type === "provider");

    if (isProvider) {
        if (window.providerCheckInterval) clearInterval(window.providerCheckInterval);
        window.providerPanelInitialized = true;
        initProviderPanelEvents();
        checkProviderStatusAndShowPanel(currentUser);
    } else {
        panel.classList.add("hidden");
        panel.style.display = "none";
    }
}

/**
 * دالة التحقق الذكية: تحدث البيانات دائمًا في الخلفية، لكن تحترم الـ Cooldown في الواجهات
 */
function checkProviderStatusAndShowPanel(directUserObj = null) {
    let currentUser = directUserObj;
    
    if (!currentUser) {
        try {
            let rawUser = JSON.parse(localStorage.getItem('map_user')) || JSON.parse(sessionStorage.getItem('user'));
            currentUser = normalizeUserObject(rawUser);
        } catch(e) {}
    }

    if (!currentUser) return;

    const panel = document.getElementById("provider-mini-panel");
    const welcomeName = document.getElementById("provider-welcome-name");
    const statusIndicator = document.getElementById("provider-status-indicator");

    const isProvider = currentUser.role === 'provider' || currentUser.account_type === 'provider';

    if (!isProvider) {
        if (panel) { panel.classList.add("hidden"); panel.style.display = "none"; }
        return;
    }

    if (panel) { panel.classList.remove("hidden"); panel.style.display = "block"; }

    if (welcomeName) welcomeName.innerText = `مرحباً، ${currentUser.full_name || currentUser.name || 'مزوّد الخدمة'}`;

    // إظهار حالة التحميل فقط إذا لم نكن في فترة انتظار الـ Cooldown حمايةً للنص المعروض للمستخدم
    if (statusIndicator && !window.isCoolingDown) {
        statusIndicator.innerText = "جارٍ التحقق من حالتك...";
        statusIndicator.style.color = "#7f8c8d";
    }

    window.currentProviderService = {
        service_layer: currentUser.service_layer,
        id: currentUser.feature_id,
        feature_id: currentUser.feature_id
    };

    let baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
    if (!baseUrl.endsWith('/')) baseUrl += '/';
    
    const userIdForQuery = currentUser.user_id || currentUser.id;
    if (!userIdForQuery) return; 

    const url = `${baseUrl}api/get-provider-service?user_id=${userIdForQuery}`;

    fetch(url)
        .then(response => response.json())
        .then(data => {
            if (!data.success || !data.service || data.user_status !== 0) {
                window.isAccountFrozen = true;
                if (statusIndicator) {
                    statusIndicator.innerText = "⚠️ ليس لديك صلاحية تعديل حالة أي معلم جاري حالياً.";
                    statusIndicator.style.setProperty("color", "#e74c3c", "important");
                }
                lockProviderButtons();
                return;
            }

            window.isAccountFrozen = false;

            if (data.service) {
                const fetchedStatus = parseInt(data.service.status);

                // تحديث الكائن بالخلفية بكافة الأحوال
                window.currentProviderService.status = fetchedStatus;
                window.currentProviderService.x_coord = data.service.x_coord ? Number(data.service.x_coord) : null;
                window.currentProviderService.y_coord = data.service.y_coord ? Number(data.service.y_coord) : null;

                // تحديث بيانات المستخدم المحلية أيضاً
                currentUser.status = fetchedStatus;
                currentUser.x_coord = data.service.x_coord ? Number(data.service.x_coord) : null;
                currentUser.y_coord = data.service.y_coord ? Number(data.service.y_coord) : null;
                currentUser.service_layer = data.service.service_layer;
                currentUser.feature_id = data.service.feature_id;
                localStorage.setItem('map_user', JSON.stringify(currentUser));

                console.log(`✅ تم تحديث بيانات مزود الخدمة: status=${fetchedStatus}, x=${window.currentProviderService.x_coord}, y=${window.currentProviderService.y_coord}`);

                // [إصلاح الحسم]: لا نحدث الـ UI أو نفك الأزرار إن كان هناك عد تنازلي نشط
                if (!window.isCoolingDown) {
                    forceUnlockButtons();
                    updateProviderPanelUI(fetchedStatus);
                }
            } else {
                console.warn("⚠️ بيانات غير مكتملة من الـ API");
                if (!window.isCoolingDown) {
                    forceUnlockButtons();
                    updateProviderPanelUI(parseInt(currentUser.status));
                }
            }
        })
        .catch(error => {
            console.error("⚠️ تعذر الاتصال بالسيرفر، الاعتماد على الكاش:", error.message);
            if (!window.isCoolingDown) {
                forceUnlockButtons();
                updateProviderPanelUI(parseInt(currentUser.status));
            }
        });
}

/**
 * نظام العد التنازلي (10 ثوانٍ) حقيقي ومحمي من التداخل
 */
function startCoolDownTimer() {
    window.isCoolingDown = true;
    let secondsLeft = 10;
    const statusIndicator = document.getElementById('provider-status-indicator');
    
    lockProviderButtons();

    if (statusIndicator) {
        statusIndicator.innerText = `⏳ يرجى الانتظار ${secondsLeft} ثانية قبل التغيير القادم...`;
        statusIndicator.style.setProperty("color", "#e67e22", "important");
    }

    const intervalId = setInterval(() => {
        secondsLeft--;
        if (statusIndicator) {
            statusIndicator.innerText = `⏳ يرجى الانتظار ${secondsLeft} ثانية قبل التغيير القادم...`;
            statusIndicator.style.setProperty("color", "#e67e22", "important");
        }

        if (secondsLeft <= 0) {
            clearInterval(intervalId);
            window.isCoolingDown = false; // فك حالة الـ Cooldown أولاً

            // فك الأزرار وتحديث الواجهة النصية
            forceUnlockButtons();
            if (statusIndicator) {
                if (window.currentProviderService) {
                    updateProviderPanelUI(window.currentProviderService.status);
                }
            }
        }
    }, 1000);
}

function updateProviderPanelUI(status) {
    if (window.isAccountFrozen) {
        lockProviderButtons();
        return;
    }

    // السماح بتحديث الواجهة حتى أثناء Cooldown لعرض الحالة الصحيحة

    const btnAvailCurrent = document.getElementById('btn-prov-available-current');
    const btnAvailPrev = document.getElementById('btn-prov-available-prev');
    const btnBusy = document.getElementById('btn-prov-busy');
    const statusIndicator = document.getElementById('provider-status-indicator');

    console.log(`🔄 تحديث الواجهة: status=${status}, btnAvailCurrent=${!!btnAvailCurrent}, btnAvailPrev=${!!btnAvailPrev}, btnBusy=${!!btnBusy}, statusIndicator=${!!statusIndicator}`);

    if (!statusIndicator) {
        console.warn("⚠️ statusIndicator غير موجود");
        return;
    }

    const currentStatus = parseInt(status);

    if (currentStatus === 0) {
        statusIndicator.innerText = "حالتك الحالية: متوفر الآن على الخريطة للجمهور 🟢";
        statusIndicator.style.setProperty("color", "#27ae60", "important");
        console.log("✅ تعيين الحالة: متوفر");
        if (btnAvailCurrent) {
            btnAvailCurrent.classList.add('active');
            console.log("✅ btnAvailCurrent تم تفعيله");
        }
        if (btnAvailPrev) {
            btnAvailPrev.classList.add('active');
            console.log("✅ btnAvailPrev تم تفعيله");
        }
        if (btnBusy) {
            btnBusy.classList.remove('active');
            console.log("✅ btnBusy تم إلغاء تفعيله");
        }
    } else {
        statusIndicator.innerText = "حالتك الحالية: غير متوفر (مخفي حالياً) 🔴";
        statusIndicator.style.setProperty("color", "#c0392b", "important");
        console.log("✅ تعيين الحالة: غير متوفر");
        if (btnBusy) {
            btnBusy.classList.add('active');
            console.log("✅ btnBusy تم تفعيله");
        }
        if (btnAvailCurrent) {
            btnAvailCurrent.classList.remove('active');
            console.log("✅ btnAvailCurrent تم إلغاء تفعيله");
        }
        if (btnAvailPrev) {
            btnAvailPrev.classList.remove('active');
            console.log("✅ btnAvailPrev تم إلغاء تفعيله");
        }
    }

    // فك الأزرار فقط إذا لم نكن في Cooldown
    if (!window.isCoolingDown) {
        forceUnlockButtons();
    }
}

// تعريف إسقاط فلسطين لضمان الدقة في أي عملية تحويل
if (typeof proj4 !== 'undefined' && !proj4.defs('EPSG:28191')) {
    proj4.defs('EPSG:28191', '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
}

function handleStatusChangeRequest(statusValue, updateGPS = false) {
    // إذا كان التتبع المباشر نشطاً، نسمح بالتحديث حتى لو كان هناك Cooldown
    if (window.isCoolingDown && !window.liveGpsInterval) return;

    if (!window.currentProviderService || !window.currentProviderService.service_layer) {
        alert("خطأ: لا توجد طبقة خدمة مرتبطة بهذا الحساب.");
        return;
    }

    const parsedStatus = parseInt(statusValue);

    window.isCoolingDown = true;
    lockProviderButtons();

    // لا نقوم بتحديث window.currentProviderService.status هنا، بل ننتظر تأكيد السيرفر

    let xPal = window.currentProviderService.x_coord;
    let yPal = window.currentProviderService.y_coord;

    if (parsedStatus === 0 && updateGPS) {
        console.log("📍 طلب إحداثيات GPS...");
        window.requestGeolocationPosition(
            (position) => {
                const latGlobal = position.coords.latitude;
                const lonGlobal = position.coords.longitude;

                const palCoords = proj4('EPSG:4326', 'EPSG:28191', [lonGlobal, latGlobal]);
                const newX = Number(parseFloat(palCoords[0]).toFixed(2));
                const newY = Number(parseFloat(palCoords[1]).toFixed(2));

                console.log(`✅ تم الحصول على إحداثيات جديدة: E:${newX}, N:${newY}`);
                sendDataToServer(parsedStatus, latGlobal, lonGlobal, newX, newY);
            },
            (error) => {
                console.warn("⚠️ الـ GPS غير متاح، سيتم استخدام الموقع السابق.", error);
                let errorMsg = 'فشل الوصول للموقع. سيتم استخدام الموقع السابق.';
                if (error.code === 1) errorMsg = 'تم رفض إذن الموقع. سيتم استخدام الموقع السابق.';
                else if (error.code === 2) errorMsg = 'إشارة GPS ضعيفة أو غير متوفرة. سيتم استخدام الموقع السابق.';
                else if (error.code === 3) errorMsg = 'انتهت مهلة طلب الموقع. سيتم استخدام الموقع السابق.';
                alert(errorMsg);
                sendDataToServer(parsedStatus, null, null, xPal, yPal);
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
    } else {
        sendDataToServer(parsedStatus, null, null, xPal, yPal);
    }
}

function sendDataToServer(status, lat, lon, xPal, yPal) {
    const parsedStatus = parseInt(status);
    let currentUser = null;
    try {
        let rawUser = JSON.parse(localStorage.getItem('map_user')) || JSON.parse(localStorage.getItem('user'));
        currentUser = normalizeUserObject(rawUser);
    } catch(e) {}
    
    const activeUserId = currentUser ? currentUser.user_id : null;
    if (!activeUserId) { window.isCoolingDown = false; forceUnlockButtons(); return; }

    let baseUrl = window.MAP_CONFIG?.server?.proxyUrl || window.location.origin + "/";
    if (!baseUrl.endsWith('/')) baseUrl += '/';

    const finalXPal = xPal ? Number(Number(xPal).toFixed(2)) : null;
    const finalYPal = yPal ? Number(Number(yPal).toFixed(2)) : null;

    if (window.currentProviderService) {
        window.currentProviderService.x_coord = finalXPal;
        window.currentProviderService.y_coord = finalYPal;
    }

    const payload = {
        user_id: parseInt(activeUserId),
        service_layer: window.currentProviderService.service_layer, 
        id: parseInt(window.currentProviderService.feature_id), 
        feature_id: parseInt(window.currentProviderService.feature_id), 
        x_coord: finalXPal, 
        y_coord: finalYPal,
        status: parsedStatus,
        account_status: parsedStatus,
        layer_status: parsedStatus
    };

    fetch(`${baseUrl}api/update-service-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(payload)
    })
    .then(response => response.json())
    .then(data => {
        console.log("✅ استجابة السيرفر:", data);

        if(currentUser) {
            currentUser.status = parsedStatus;
            if (finalXPal) currentUser.x_coord = finalXPal;
            if (finalYPal) currentUser.y_coord = finalYPal;
            localStorage.setItem('map_user', JSON.stringify(currentUser));
        }

        // تحديث حالة مزود الخدمة في الذاكرة
        if (window.currentProviderService) {
            window.currentProviderService.status = parsedStatus;
            console.log("✅ تم تحديث الحالة في الذاكرة:", parsedStatus);
        }

        // تحديث الواجهة فوراً قبل تشغيل Cooldown
        updateProviderPanelUI(parsedStatus);

        // تحديث الطبقة على خريطة OpenLayers حياً بدون الحاجة لعمل WFS-T معقد
        if (window.map && payload.service_layer) {
            const cleanLayerKey = payload.service_layer.toLowerCase().replace('services:', '').replace('layer', '').trim();
            window.map.getLayers().forEach(layer => {
                const title = (layer.get('title') || "").toLowerCase();
                const name = (layer.get('name') || "").toLowerCase();
                if ((name.includes(cleanLayerKey) || title.includes(cleanLayerKey)) && layer.getSource()) {
                    const source = layer.getSource();
                    if (typeof source.clear === 'function') source.clear();
                    if (typeof source.refresh === 'function') source.refresh();
                }
            });
        }

        // تشغيل مؤقت الـ Cooldown الفعلي الآن للتأمين الإجباري لـ 10 ثوانٍ
        startCoolDownTimer();
    })
    .catch(error => {
        console.error("❌ خطأ أثناء التحديث عبر الـ API:", error.message);
        window.isCoolingDown = false;
        if (window.currentProviderService) {
            updateProviderPanelUI(window.currentProviderService.status);
        }
    });
}

function flyToServiceLocation() {
    console.log("📍 تم النقر على زر الانتقال إلى موقعي");
    console.log("📍 بيانات مزود الخدمة الحالية:", window.currentProviderService);
    console.log("📍 الخريطة موجودة:", !!window.map);

    if (!window.map || !window.currentProviderService || !window.currentProviderService.feature_id) {
        console.warn("⚠️ لا يمكن الانتقال: بيانات غير مكتملة", window.currentProviderService);
        return;
    }
    const x = window.currentProviderService.x_coord;
    const y = window.currentProviderService.y_coord;
    const view = window.map.getView();
    console.log(`📍 محاولة الانتقال إلى: x=${x}, y=${y}`);
    if (x && y && x > 100000) {
        const coords = [Number(x), Number(y)];

        if (window.providerFlyToLayer) {
            const source = window.providerFlyToLayer.getSource();
            source.clear();
            const feat = new ol.Feature(new ol.geom.Point(coords));
            source.addFeature(feat);
        }

        view.animate({ center: coords, zoom: 19, duration: 1200 });
    } else {
        console.warn("⚠️ الإحداثيات غير صالحة:", x, y);
    }
}

function initProviderPanelEvents() {
    const btnAvailCurrent = document.getElementById("btn-prov-available-current");
    const btnAvailPrev = document.getElementById("btn-prov-available-prev");
    const btnBusy = document.getElementById("btn-prov-busy");
    const btnFly = document.getElementById("btn-prov-fly");
    const btnLiveGps = document.getElementById("btn-prov-live-gps");
    if (btnLiveGps && !btnLiveGps.dataset.hasListener) {
        btnLiveGps.addEventListener("click", toggleLiveGpsTracking);
        btnLiveGps.dataset.hasListener = "true";
    }

    if (btnAvailCurrent && !btnAvailCurrent.dataset.hasListener) {
        btnAvailCurrent.addEventListener("click", () => handleStatusChangeRequest(0, true)); 
        btnAvailCurrent.dataset.hasListener = "true";
    }
    if (btnAvailPrev && !btnAvailPrev.dataset.hasListener) {
        btnAvailPrev.addEventListener("click", () => handleStatusChangeRequest(0, false)); 
        btnAvailPrev.dataset.hasListener = "true";
    }
    if (btnBusy && !btnBusy.dataset.hasListener) {
        btnBusy.addEventListener("click", () => handleStatusChangeRequest(1, false)); 
        btnBusy.dataset.hasListener = "true";
    } 
    if (btnFly && !btnFly.dataset.hasListener) {
        btnFly.addEventListener("click", flyToServiceLocation);
        btnFly.dataset.hasListener = "true";
    }
}

// ==========================================
// تصغير وتكبير لوحة مزود الخدمة
// ==========================================
(function initProviderPanelToggle() {
    function setup() {
        const panel = document.getElementById('provider-panel'); 
        const toggleBtn = document.querySelector('.panel-minimize-btn');
        const panelBody = document.querySelector('.provider-panel-body');

        // فحص أمان: إذا لم توجد العناصر، نتوقف عن التنفيذ فوراً لتجنب الخطأ
        if (!panel || !toggleBtn || !panelBody) {
            console.warn("⚠️ لم يتم العثور على عناصر اللوحة، تخطي التهيئة.");
            return;
        }

        const savedPos = localStorage.getItem('provider_panel_pos');
        if (savedPos) {
            try {
                const pos = JSON.parse(savedPos);
                panel.style.left = pos.left;
                panel.style.top = pos.top;
            } catch (e) { console.error("Error parsing panel position"); }
        }
        
        let isMinimized = false;

        toggleBtn.addEventListener('click', function () {
            isMinimized = !isMinimized;
            // فحص أمان إضافي عند النقر
            if (panelBody) {
                panelBody.style.display = isMinimized ? 'none' : 'block';
            }
            toggleBtn.textContent = isMinimized ? '+' : '−';
            toggleBtn.title = isMinimized ? 'تكبير اللوحة' : 'تصغير اللوحة';
        });
    }

    // التأكد من أن DOM جاهز تماماً قبل التنفيذ
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setup);
    } else {
        // تأخير بسيط لضمان تحميل جميع العناصر الديناميكية
        setTimeout(setup, 500); 
    }
})();

/**
 * هذا الكود يجمع بين:
 * 1. إمكانية سحب اللوحة من الهيدر
 * 2. إمكانية تصغير وتكبير اللوحة
 */
(function setupProviderPanel() {
    const panel = document.getElementById('provider-mini-panel');
    if (!panel) return;

    const header = panel.querySelector('.panel-header');
    const toggleBtn = panel.querySelector('.panel-minimize-btn');
    const body = panel.querySelector('.provider-panel-body');

    // 1. منطق التصغير (يعمل باللمس والماوس تلقائياً)
    if (toggleBtn) {
        toggleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const isHidden = body.style.display === 'none';
            body.style.display = isHidden ? 'block' : 'none';
            toggleBtn.textContent = isHidden ? '−' : '+';
        });
    }

    // 2. منطق التحريك (دعم الماوس واللمس)
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    function startDrag(e) {
        isDragging = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        offset.x = clientX - panel.offsetLeft;
        offset.y = clientY - panel.offsetTop;
        panel.style.transition = 'none';
    }

    function moveDrag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        
        requestAnimationFrame(() => {
            panel.style.left = (clientX - offset.x) + 'px';
            panel.style.top = (clientY - offset.y) + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });
    }

    function endDrag() {
        if (!isDragging) return;
        isDragging = false;
        // حفظ الموقع الحالي في localStorage
        localStorage.setItem('provider_panel_pos', JSON.stringify({
            left: panel.style.left,
            top: panel.style.top
        }));
    }

    // ربط الأحداث
    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDrag, { passive: false });
    
    document.addEventListener('mousemove', moveDrag);
    document.addEventListener('touchmove', moveDrag, { passive: false });
    
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchend', endDrag);
})();

function toggleLiveGpsTracking() {
    const btn = document.getElementById('btn-prov-live-gps');
    
    // إذا كان التتبع يعمل، أوقفه
    if (window.liveGpsInterval) {
        clearInterval(window.liveGpsInterval);
        window.liveGpsInterval = null;
        btn.style.background = "#fff";
        btn.style.color = "#2980b9";
        btn.innerText = "📍 تتبع مباشر (كل 10 ثوانٍ)";
        return;
    }

    // تفعيل التتبع
    btn.style.background = "#2980b9";
    btn.style.color = "#fff";
    btn.innerText = "🛑 إيقاف التتبع المباشر";

    // تنفيذ أول مرة فوراً
    handleStatusChangeRequest(0, true);

    // تكرار كل 10 ثوانٍ
    window.liveGpsInterval = setInterval(() => {
        console.log("🔄 تحديث تلقائي للموقع...");
        handleStatusChangeRequest(0, true);
    }, 10000);
}