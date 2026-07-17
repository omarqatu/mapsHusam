// js/popup.js

// 1. دالة تُستدعى لحظة الإرسال للحصول على user_id الحقيقي دائماً
function getRealUserId() {
    try {
        const saved = localStorage.getItem('map_user');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed && (parsed.user_id || parsed.id)) {
                return String(parsed.user_id || parsed.id);
            }
        }
    } catch(e) {}
    // fallback للـ GUID العشوائي إذا لم يكن المستخدم مسجلاً
    if (!localStorage.getItem('map_user_guid')) {
        localStorage.setItem('map_user_guid', 'guest_' + Math.random().toString(36).substr(2, 9));
    }
    return localStorage.getItem('map_user_guid');
}

// 2. دالة تسجيل حدث/نقرة على الخريطة أو البحث
async function logMapEvent(eventType, provider = null, service = null) {
    try {
        const userId = getRealUserId();
        const serverUrl = window.location.origin + '/api/log-map-event';
        
        await fetch(serverUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: userId,
                event_type: eventType,
                provider: provider,
                service: service
            })
        });
    } catch (err) {
        console.warn('فشل تسجيل الحدث:', err.message);
    }
}

function initializePopup(map) {
    const container = document.getElementById('popup');
    const content = document.getElementById('popup-content');
    const closer = document.getElementById('popup-closer');
    const togglePopupBtn = document.getElementById('togglePopupBtn'); 
    const popupTitle = document.getElementById('popup-title');

    if (!container || !content || !closer || !togglePopupBtn || !map || !popupTitle) {
        console.error('عناصر البوب أب ناقصة في الـ HTML.');
        return;
    }

    let isPopupEnabled = true; 
    let isPopupPinned = false; 
    
    togglePopupBtn.classList.add('active-tool');
    togglePopupBtn.style.backgroundColor = "#e1f5fe";

    // مصفوفة الخدمات الشاملة
    const serviceLayerNames = [
        'فني كهرباء', 'فني تكييف وتبريد', 'سباك (مواسيرجي)', 'صيانة عامة', 'دهان/طراشة', 'فني ديكور',
        'نجار', 'حداد', 'بناء ومعمار', 'خدمات تنظيف', 'فني ألمنيوم', 'ميكانيكي سيارات',
        'كهربائي سيارات', 'بنشري / إطارات', 'غسيل سيارات', 'صيانة دراجات نارية', 
        'مكتب تاكسي', 'خدمات توصيل', 'ونش إنقاذ', 'فني كاميرات مراقبة', 
        'منظم حفلات', 'فرقة زفة', 'فرق موسيقية',  'تأجير مستلزمات حفلات',
        'تمريض منزلي', 'أخصائي مساج', 'أخصائي حجامة', 'أخصائي تغذية', 'سائق شاحنة',
        'شركات أمن وحراسة', 'شراء أثاث مستعمل', 'تنسيق حدائق', 'رعاية حيوانات أليفة', 'مهرج وعروض أطفال',
        'متاجر أون لاين', 'فلل أجار', 'فنون قتالية وجمباز', 'حدائق ومناطق ترفيهية',
        'فنادق', 'توزيع أغراض مجاناً', 'حلاقة شباب', 'مصور فوتوغرافي', 'تصميم فيديو إعلاني', 
        'صيدليات مناوبة', 'تكاسي نظام مناوبة', 'طوارئ ومستشفيات', 'عيادات', 
        'دكاترة مناوبة', 'إسعاف مناوبة', 'تدريب موسيقى ومعاهد', 'محاميين', 
        'مساحين أراضي', 'مخمنين عقاريين', 'أساتذة خصوصي', 'مبرمجين', 
        'دليفري سيارات (مناوبة)', 'دليفري دراجات (مناوبة)', 'دليفري هوائية (مناوبة)', 
         'مساعد أبحاث طلاب'
    ];

    const realEstateLayerNames = ['شقق الإيجار', 'شقق للبيع', 'الأراضي للبيع']; // تم تصحيح المسمى ليطابق config.js
    const areaLayerName = 'المناطق';

    function isLayerAllowed(layer) {
        if (!layer) return false;
        const layerTitle = layer.get('title');
        const layerKey = Object.keys(window.appLayers).find(key => window.appLayers[key] === layer);
        const layerBaseName = layerKey ? layerKey.replace('Layer', '') : null;

        return (serviceLayerNames.includes(layerTitle) || realEstateLayerNames.includes(layerTitle) || layerTitle === areaLayerName) && (!MAP_CONFIG.globalExclusions || !MAP_CONFIG.globalExclusions.includes(layerBaseName));
    }

    function cleanUrl(rawUrl) {
        if (!rawUrl || rawUrl === "" || rawUrl === "#" || rawUrl === "undefined") return null;
        let url = rawUrl.toString().trim();
        if (url.includes('<iframe')) {
            const match = url.match(/src="([^"]+)"/);
            if (match) url = match[1];
        }
        url = url.replace(/["']/g, ""); 
        return url;
    }

    // --- 🆕 فحص حد الطلبات (الأحداث) المُعرّف من المشرف قبل تنفيذ أي اتصال/واتساب ---
    // افتراضياً كل المستخدمين "مفتوحين" بدون أي حد؛ لا يُطبَّق الفحص إلا إذا حدد
    // المشرف رقماً صريحاً لهذا المستخدم من لوحة إدارة المستخدمين.
    async function checkRequestQuotaOrAlert(userId, popupRef) {
        try {
            const serverUrl = window.location.origin + '/api/check-request-limit';
            const res = await fetch(serverUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId })
            });
            const data = await res.json();

            if (data && data.allowed === false) {
                if (popupRef && !popupRef.closed) popupRef.close();
                const periodLabels = { daily: 'اليوم', weekly: 'هذا الأسبوع', monthly: 'هذا الشهر' };
                const periodText = periodLabels[data.period] || 'هذه الفترة';
                alert(`⛔ لقد تجاوزت الحد المسموح من الطلبات (${data.limit}) ${periodText}. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.`);
                return { allowed: false };
            }
            return { allowed: true };
        } catch (err) {
            // فشل الفحص لأي سبب (شبكة/سيرفر) => لا نمنع المستخدم من استخدام الخدمة الأساسية (Fail-open)
            console.warn('تعذر التحقق من حد الطلبات، سيتم السماح بالطلب:', err.message);
            return { allowed: true };
        }
    }

    // --- تعديل منطق الواتساب (يأخذ القيمة كما هي من الحقل) ---
    window.handlePhoneCall = async function(providerName, localPhone, whatsappNumber, serviceType) {
        const currentUserId = getRealUserId();
        const quota = await checkRequestQuotaOrAlert(currentUserId, null);
        if (!quota.allowed) return;

        const serviceDescription = `(${serviceType}) اتصال مباشر`;
        if (window.sendTrackingRequest) {
            window.sendTrackingRequest(providerName, serviceDescription);
        } else {
            const serverUrl = window.location.origin + '/save-stat';
            navigator.sendBeacon
                ? navigator.sendBeacon(serverUrl, new Blob([JSON.stringify({ user_id: currentUserId, provider: providerName, service: serviceDescription })], { type: 'application/json' }))
                : fetch(serverUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, provider: providerName, service: serviceDescription }), keepalive: true }).catch(err => console.error('خطأ في تسجيل الإحصائية:', err));
        }

        window.location.href = 'tel:' + localPhone;
    };

    window.handleServiceRequest = async function(providerName, whatsappNumber, serviceType) {
        // نفتح تبويباً فارغاً فوراً ضمن نفس حركة المستخدم (Click) لتفادي حجب المتصفح
        // للنوافذ المنبثقة، ثم نوجهه للرابط الصحيح بعد التأكد من عدم تجاوز الحد
        const newTab = window.open('', '_blank');

        const currentUserId = getRealUserId();
        const quota = await checkRequestQuotaOrAlert(currentUserId, newTab);
        if (!quota.allowed) return;

        const serviceDescription = `(${serviceType}) واتساب`;
        if (window.sendTrackingRequest) {
            window.sendTrackingRequest(providerName, serviceDescription);
        } else {
            const serverUrl = window.location.origin + '/save-stat';
            navigator.sendBeacon
                ? navigator.sendBeacon(serverUrl, new Blob([JSON.stringify({ user_id: currentUserId, provider: providerName, service: serviceDescription })], { type: 'application/json' }))
                : fetch(serverUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: currentUserId, provider: providerName, service: serviceDescription }), keepalive: true }).catch(err => console.error('خطأ في تسجيل الإحصائية:', err));
        }

        const message = `مرحباً ${providerName}، أرغب بالاستفسار عن (${serviceType}) من خلال الخريطة.`;
        
        // تنظيف الرقم من أي رموز أو مسافات (فقط أرقام)
        let cleanNumber = whatsappNumber.toString().replace(/\D/g, '');

        // إذا كان الشخص أدخل الرقم بـ 00 في البداية، نحذفها لأن رابط wa.me لا يقبلها
        if (cleanNumber.startsWith('00')) {
            cleanNumber = cleanNumber.substring(2);
        }

        // ملاحظة: الرابط سيعمل إذا كان الرقم يبدأ بـ 970 أو 972 مباشرة
        const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;
        if (newTab) {
            newTab.location.href = whatsappUrl;
        } else {
            window.open(whatsappUrl, '_blank');
        }
    };

    function createLink(url, text = "للتفاصيل انقر هنا") {
        const validatedUrl = cleanUrl(url);
        if (!validatedUrl) return '';
        let finalUrl = validatedUrl;
        if (!finalUrl.startsWith('http')) finalUrl = 'https://' + finalUrl;
        return `<a href="${finalUrl}" target="_blank" class="popup-link">${text}</a>`;
    }

    function createImageElement(url) {
        const validatedUrl = cleanUrl(url);
        if (!validatedUrl) return '';
        return `<div class="popup-img-container" style="margin-top:10px; text-align:center;">
                    <img src="${validatedUrl}" class="popup-img" style="max-width:100%; border-radius:8px; display:block; margin:auto;" onerror="this.style.display='none'">
                </div>`;
    }

window.copyLocationLink = function(coordinate) {
        if (!coordinate || coordinate.length < 2) {
            alert('لا يمكن نسخ الموقع');
            return;
        }

        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        params.set('x', coordinate[0]);
        params.set('y', coordinate[1]);

        const shareLink = `${baseUrl}?${params.toString()}`;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // 📱 على الموبايل: استخدام قائمة المشاركة الأصلية لتفادي مشكلة تحويل الرابط لبحث جوجل عند اللصق
        if (isMobile && navigator.share) {
            navigator.share({
                title: 'موقع على الخريطة',
                url: shareLink
            }).catch(() => { /* المستخدم ألغى المشاركة، لا حاجة لفعل شيء */ });
            return;
        }

        // 💻 على الكمبيوتر (أو إذا كانت المشاركة الأصلية غير مدعومة): نسخ تقليدي للحافظة
        const textarea = document.createElement('textarea');
        textarea.value = shareLink;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();

        try {
            const successful = document.execCommand('copy');
            document.body.removeChild(textarea);

            if (successful) {
                alert('تم نسخ رابط الموقع بنجاح! يمكنك مشاركته الآن.');
            } else {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareLink).then(() => {
                        alert('تم نسخ الرابط بنجاح! يمكنك مشاركته الآن.');
                    }).catch(err => {
                        console.error('فشل نسخ الرابط:', err);
                        alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
                    });
                } else {
                    alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
                }
            }
        } catch (err) {
            document.body.removeChild(textarea);
            console.error('فشل نسخ الرابط:', err);
            alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
        }
    };
    
    // استبدل تعريف الـ overlay الحالي بهذا التعريف
        const overlay = new ol.Overlay({
            element: container,
            autoPan: {
                animation: { duration: 250 },
                margin: 40
            },
            // تغيير التموضع إلى 'bottom-center' مع السماح للمكتبة بالتعامل معه
            positioning: 'bottom-center',
            stopEvent: true,
            offset: [0, -15] 
        });

        // هذا الجزء هو المسؤول عن تحديث الكلاس بناءً على التموضع الفعلي (السر هنا)
        overlay.on('change:positioning', function(e) {
            const positioning = overlay.getPositioning();
            container.classList.remove('ol-position-top', 'ol-position-bottom');
            
            // إذا تغير التموضع إلى top-center يعني النافذة أصبحت تحت النقطة
            if (positioning === 'top-center') {
                container.classList.add('ol-position-top');
            } else {
                container.classList.add('ol-position-bottom');
            }
        });

    map.addOverlay(overlay);
    
    window.setPopupState = function(state) {
        isPopupEnabled = state;
        if (!state) window.hideFeaturePopup();
        
        if (isPopupEnabled) {
            togglePopupBtn.style.backgroundColor = "#e1f5fe";
            togglePopupBtn.innerHTML = '<i class="fas fa-info-circle"></i>';
        } else {
            togglePopupBtn.style.backgroundColor = "";
            togglePopupBtn.innerHTML = '<i class="fas fa-comment-slash"></i>';
        }
    };

    togglePopupBtn.onclick = function() {
        window.setPopupState(!isPopupEnabled);
    };

    function parseArabicTime(timeStr) {
        if (!timeStr) return "";
        let [hours, minutes] = timeStr.split(':').map(Number);
        const hoursArabic = {
            0: "الثانية عشرة", 1: "الواحدة", 2: "الثانية", 3: "الثالثة", 4: "الرابعة", 
            5: "الخامسة", 6: "السادسة", 7: "السابعة", 8: "الثامنة", 9: "التاسعة", 
            10: "العاشرة", 11: "الحادية عشرة", 12: "الثانية عشرة"
        };
        let period = hours >= 12 ? "مساءً" : "صباحاً";
        let hourIn12 = hours % 12 || 12;
        if (hours === 12) period = "ظهراً";
        if (hours === 0) period = "منتصف الليل";
        let minuteName = (minutes > 0) ? ` و ${minutes} دقيقة` : "";
        return `${hoursArabic[hourIn12]}${minuteName} ${period}`;
    }

    function formatWorkHours(workHours) {
        if (!workHours || workHours.trim() === "" || workHours === "00:00-23:59") return "دوام 24 ساعة";
        const parts = workHours.split('-');
        if (parts.length !== 2) return workHours;
        try {
            return `متاح من ${parseArabicTime(parts[0].trim())} حتى ${parseArabicTime(parts[1].trim())}`;
        } catch (e) { return workHours; }
    }

    function getStatusHtml(autoStatus, workHours) {
        const status = parseInt(autoStatus);
        const isAvailable = status === 0;
        const color = isAvailable ? "#28a745" : "#dc3545";
        const text = isAvailable ? "متاح الآن" : "مغلق حالياً";
        const icon = isAvailable ? "🟢" : "🔴";
        const timeText = formatWorkHours(workHours);
        return `<div style="margin: 10px 0; padding: 10px; border-radius: 8px; background: ${color}10; border: 1px dashed ${color}; text-align: center;">
                    <span style="color: ${color}; font-weight: bold; font-size: 14px;">${icon} ${text}</span>
                    <div style="font-size: 12px; color: #444; margin-top: 5px; line-height: 1.4;">${timeText}</div>
                </div>`;
    }
            function getCurrencySymbol(code) {
                    const symbols = { USD: 'دولار', ILS: 'شيقل', JOD: 'دينار' };
                    return symbols[code] || '';
                }
    window.generateFeatureHtml = function(feature, layer) {
        const props = feature.getProperties();
        const layerTitle = layer ? (layer.get('title') || 'معلم') : 'معلم';
        
        const isRealEstate = realEstateLayerNames.includes(layerTitle);
        const isService = serviceLayerNames.includes(layerTitle);
        const isAreaLayer = layerTitle === areaLayerName; 

        // 🆕 استخراج رقم الـ ID المناسب لعرضه بجانب التصنيف:
        // العقارات (شقق إيجار/بيع، أراضي للبيع) => العمود الرئيسي fid
        // الخدمات => العمود الرئيسي id
        let displayFeatureId = null;
        if (isRealEstate) {
            displayFeatureId = (props.fid !== undefined && props.fid !== null && props.fid !== '') ? props.fid : null;
        } else if (isService) {
            displayFeatureId = (props.id !== undefined && props.id !== null && props.id !== '') ? props.id : null;
        }
        // احتياط: إذا الحقل مش موجود كـ property (يصير أحياناً مع WFS من GeoServer)،
        // نستخرجه من معرف OpenLayers الداخلي للمعلم (شكله مثلاً "ApartRent.123")
        if (displayFeatureId === null && typeof feature.getId === 'function') {
            const olId = feature.getId();
            if (olId) {
                const idParts = String(olId).split('.');
                displayFeatureId = idParts[idParts.length - 1];
            }
        }

        if (popupTitle) {
            if (!isAreaLayer) {
                popupTitle.innerHTML = ""; 
                popupTitle.style.display = "none"; 
            } else {
                const headerName = window.sanitizeHTML(props.name || props.location_name || "تفاصيل المنطقة");
                popupTitle.innerHTML = `<span class="popup-header-title">${headerName}</span>`;
                popupTitle.style.display = "block";
            }
        }

        let bodyHtml = `<div class="popup-body" style="font-size: 13px; line-height: 1.6; max-height:350px; overflow-y:auto; padding-right:5px; direction: rtl; text-align: right;">`;
        bodyHtml += `<div style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;"><b style="color: #007bff;">🛠️ التصنيف:</b> <b>${layerTitle}</b>${displayFeatureId !== null ? ` <span style="color:#888; font-size:12px;">(رقم: ${window.sanitizeHTML(String(displayFeatureId))})</span>` : ''}</div>`;
        
        if (!isAreaLayer) bodyHtml += getStatusHtml(props.auto_status, props.work_hours);

        if (isRealEstate || isService) {
            if (props.name) bodyHtml += `<b>👤 الاسم:</b> ${window.sanitizeHTML(props.name)}<br>`;
            if (props.location_name || props.location) bodyHtml += `<b>📍 الموقع:</b> ${window.sanitizeHTML(props.location_name || props.location)}<br>`;
            
            if (isRealEstate) {
                if (props.price) bodyHtml += `<b>💰 السعر:</b> ${Number(props.price).toLocaleString()} ${getCurrencySymbol(props.currency)}<br>`;
                if (props.area) bodyHtml += `<b>📐 المساحة:</b> ${props.area} م²<br>`;
                if (props.village_a) bodyHtml += `<b>🏘️ البلدة:</b> ${window.sanitizeHTML(props.village_a)}<br>`;
                if (props.gov_a) bodyHtml += `<b>🌍 المحافظة:</b> ${window.sanitizeHTML(props.gov_a)}<br>`;
                if (props.des) bodyHtml += `<div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px;"><b>📝 الوصف:</b> ${window.sanitizeHTML(props.des)}</div>`;
                if (props.video) bodyHtml += `<div style="margin-top:8px;">🎥 ${createLink(props.video, "عرض الفيديو")}</div>`;
            } 

            if (props.des && !isRealEstate) bodyHtml += `<div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px;"><b>📝 الوصف:</b> ${props.des}</div>`;
            
            if (props.whatsapp) {
                const whatsappNumber = props.whatsapp.toString();
                const providerName = props.name || (isRealEstate ? "المعلن" : "مزود الخدمة");

                // استخراج رقم الجوال المحلي: حذف أول 5 أرقام واستبدالها بـ 0
                const cleanDigits = whatsappNumber.replace(/\D/g, '');
                const localPhone = '0' + cleanDigits.slice(5);

                bodyHtml += `
                <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                    <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                        <button onclick="handlePhoneCall('${providerName}', '${localPhone}', '${whatsappNumber}', '${layerTitle}')"
                                style="flex: 1; background: #1a73e8; color: white; border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; box-shadow: 0 4px 12px rgba(26,115,232,0.3);">
                            <i class="fas fa-mobile-alt" style="font-size: 16px;"></i> اتصال
                        </button>
                        <button onclick="handleServiceRequest('${providerName}', '${whatsappNumber}', '${layerTitle}')"
                                style="flex: 1; background: #25d366; color: white; border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; box-shadow: 0 4px 12px rgba(37,211,102,0.3);">
                            <i class="fab fa-whatsapp" style="font-size: 16px;"></i> واتساب
                        </button>
                    </div>
                </div>`;
            }

            // زر نسخ رابط الموقع يظهر لجميع المعالم
            bodyHtml += `
            <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                <button onclick="copyLocationLink(window.currentPopupCoordinate)"
                        style="width: 100%; background: #6c757d; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; box-shadow: 0 4px 12px rgba(108,117,125,0.3);">
                    <i class="fas fa-link" style="font-size: 14px;"></i> نسخ رابط الموقع
                </button>
            </div>`;

            if (props.details_link_1 || props.pic) {
                if (props.details_link_1) bodyHtml += `<div style="margin-top:8px;">🔗 ${createLink(props.details_link_1, "تفاصيل إضافية")}</div>`;
                if (props.pic) bodyHtml += `<hr>${createImageElement(props.pic)}`;
            }
        } else if (isAreaLayer) {
            const areaFieldLabels = {
                'gov_a': '🌍 اسم المحافظة',
                'village_a': '🏘️ المدينة / القرية',
                'location': '📍 المنطقة'
            };

            Object.keys(props).forEach(key => {
                if (['geometry', 'auto_status', 'work_hours', 'whatsapp', 'objectid', 'OBJECTID', 'rating'].includes(key)) return;
                const label = areaFieldLabels[key] || key;
                bodyHtml += `<b>${label}:</b> ${props[key]}<br>`;
            });

            // زر نسخ رابط الموقع يظهر للمناطق أيضاً
            bodyHtml += `
            <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                <button onclick="copyLocationLink(window.currentPopupCoordinate)"
                        style="width: 100%; background: #6c757d; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; box-shadow: 0 4px 12px rgba(108,117,125,0.3);">
                    <i class="fas fa-link" style="font-size: 14px;"></i> نسخ رابط الموقع
                </button>
            </div>`;
        }

        bodyHtml += `</div>`;
        return bodyHtml;
    };

    window.hideFeaturePopup = function() {
        overlay.setPosition(undefined);
        isPopupPinned = false;
        if (popupTitle) popupTitle.style.display = "none";
    };

    closer.onclick = function() {
        window.hideFeaturePopup();
        return false;
    };

    map.on('singleclick', function(event) {
        if (!isPopupEnabled) return;
        let featureFound = false;
        map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
            if (isLayerAllowed(layer)) {
                featureFound = true;
                window.currentPopupCoordinate = event.coordinate;
                content.innerHTML = window.generateFeatureHtml(feature, layer);
                overlay.setPosition(event.coordinate);
                isPopupPinned = true;

                // تسجيل حدث النقر على الخريطة
                const layerTitle = layer.get('title') || 'معلم';
                const props = feature.getProperties();
                const providerName = props.name || (props.location_name || 'غير معروف');
                logMapEvent('map_click', providerName, layerTitle);

                return true;
            }
        });
        if (!featureFound) window.hideFeaturePopup();
    });

    map.on('pointermove', function(event) {
        if (!isPopupEnabled || isPopupPinned || event.dragging) return;
        const pixel = map.getEventPixel(event.originalEvent);
        let featureFound = false;
        map.forEachFeatureAtPixel(pixel, function(feature, layer) {
            if (isLayerAllowed(layer)) {
                featureFound = true;
                window.currentPopupCoordinate = event.coordinate;
                content.innerHTML = window.generateFeatureHtml(feature, layer);
                overlay.setPosition(event.coordinate);
                map.getTargetElement().style.cursor = 'pointer';
                return true;
            }
        });
        if (!featureFound) {
            overlay.setPosition(undefined);
            map.getTargetElement().style.cursor = '';
        }
    });

    // قراءة معاملات URL وفتح البوب أب تلقائياً
    function openLocationFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const x = urlParams.get('x');
        const y = urlParams.get('y');

        if (!x || !y) return;

        const coordinate = [parseFloat(x), parseFloat(y)];

        if (isNaN(coordinate[0]) || isNaN(coordinate[1])) return;

        // تحريك الخريطة إلى الموقع
        map.getView().animate({
            center: coordinate,
            zoom: 19,
            duration: 1000
        });

        // إظهار البوب أب في الموقع
        window.currentPopupCoordinate = coordinate;
        content.innerHTML = `<div style="padding:10px; text-align:center;">
            <strong>📍 الموقع المشارك</strong><br>
            <small>تم توجيهك إلى هذا الموقع</small>
        </div>`;
        overlay.setPosition(coordinate);
        isPopupPinned = true;
    }

    // استدعاء الدالة بعد تحميل الخريطة
    setTimeout(openLocationFromUrl, 1000);
}