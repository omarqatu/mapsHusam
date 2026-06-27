/**
 * js/provider-panel.js - نسخة الحسم النهائي الشامل والكامل 2026
 * التحديث: إلغاء الاعتماد على الكاش في عرض الحالة (API-First Strategy)
 * المعالجة: حل مشكلة عدم تطابق الحالة (Status Mismatch) وتأمين ثغرة الـ Cooldown
 * ملاحظة: لا يتم تغيير أسماء الحقول في قاعدة البيانات منعاً لتعطل المصادقة
 */

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
    // لا نسمح بفك القفل إطلاقاً إذا كان الـ Cooldown نشطاً أو الحساب مجمداً
    if (window.isCoolingDown || window.isAccountFrozen) return;

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
                
                currentUser.status = fetchedStatus;
                currentUser.service_layer = data.service.service_layer;
                currentUser.feature_id = data.service.feature_id;
                localStorage.setItem('map_user', JSON.stringify(currentUser));
                
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
            
            // تحديث الواجهة وفك الأزرار رسمياً بناءً على آخر حالة مؤكدة مخزنة
            if (window.currentProviderService) {
                updateProviderPanelUI(window.currentProviderService.status);
            }
        }
    }, 1000);
}

function updateProviderPanelUI(status) {
    if (window.isAccountFrozen) {
        lockProviderButtons();
        return;
    }

    if (window.isCoolingDown) return; 
    
    // فك القفل أصبح آمناً الآن
    const btnAvailCurrent = document.getElementById('btn-prov-available-current');
    const btnAvailPrev = document.getElementById('btn-prov-available-prev');
    const btnBusy = document.getElementById('btn-prov-busy');
    const statusIndicator = document.getElementById('provider-status-indicator');

    forceUnlockButtons();

    if (!statusIndicator) return;

    const currentStatus = parseInt(status);

    if (currentStatus === 0) {
        statusIndicator.innerText = "حالتك الحالية: متوفر الآن على الخريطة للجمهور 🟢";
        statusIndicator.style.setProperty("color", "#27ae60", "important");
        if (btnAvailCurrent) btnAvailCurrent.classList.add('active');
        if (btnAvailPrev) btnAvailPrev.classList.add('active');
        if (btnBusy) btnBusy.classList.remove('active');
    } else {
        statusIndicator.innerText = "حالتك الحالية: غير متوفر (مخفي حالياً) 🔴";
        statusIndicator.style.setProperty("color", "#c0392b", "important");
        if (btnBusy) btnBusy.classList.add('active');
        if (btnAvailCurrent) btnAvailCurrent.classList.remove('active');
        if (btnAvailPrev) btnAvailPrev.classList.remove('active');
    }
}

// تعريف إسقاط فلسطين لضمان الدقة في أي عملية تحويل
if (typeof proj4 !== 'undefined' && !proj4.defs('EPSG:28191')) {
    proj4.defs('EPSG:28191', '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
}

function handleStatusChangeRequest(statusValue, updateGPS = false) {
    if (window.isCoolingDown) return;

    if (!window.currentProviderService || !window.currentProviderService.service_layer) {
        alert("خطأ: لا توجد طبقة خدمة مرتبطة بهذا الحساب.");
        return;
    }

    const parsedStatus = parseInt(statusValue);

    // تفعيل الـ Cooldown فوراً عند الضغط لمنع الـ Double-Click
    window.isCoolingDown = true;
    lockProviderButtons();

    // تحديث تفاؤلي للواجهة (Optimistic UI) وثم بدء تشغيل العداد الشكلي بانتظار استجابة الـ Fetch
    window.currentProviderService.status = parsedStatus;
    
    let xPal = window.currentProviderService.x_coord;
    let yPal = window.currentProviderService.y_coord;

    if (parsedStatus === 0 && updateGPS && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
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
                console.warn("⚠️ الـ GPS غير متاح، سيتم استخدام الموقع السابق.");
                sendDataToServer(parsedStatus, null, null, xPal, yPal);
            },
            { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
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
        if(currentUser) {
            currentUser.status = parsedStatus;
            if (finalXPal) currentUser.x_coord = finalXPal;
            if (finalYPal) currentUser.y_coord = finalYPal;
            localStorage.setItem('map_user', JSON.stringify(currentUser));
        }

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

        // فحص تحديثي صامت بعد ثانية للتأكد من المزامنة المطلقة مع السيرفر دون تخريب عداد الـ Cooldown
        setTimeout(() => { checkProviderStatusAndShowPanel(); }, 1000);
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
    if (!window.map || !window.currentProviderService || !window.currentProviderService.feature_id) return;
    const x = window.currentProviderService.x_coord;
    const y = window.currentProviderService.y_coord;
    const view = window.map.getView();
    if (x && y && x > 100000) {
        const coords = [Number(x), Number(y)];
        
        if (window.providerFlyToLayer) {
            const source = window.providerFlyToLayer.getSource();
            source.clear();
            const feat = new ol.Feature(new ol.geom.Point(coords));
            source.addFeature(feat);
        }

        view.animate({ center: coords, zoom: 19, duration: 1200 });
    }
}

function initProviderPanelEvents() {
    const btnAvailCurrent = document.getElementById("btn-prov-available-current");
    const btnAvailPrev = document.getElementById("btn-prov-available-prev");
    const btnBusy = document.getElementById("btn-prov-busy");
    const btnFly = document.getElementById("btn-prov-fly");

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