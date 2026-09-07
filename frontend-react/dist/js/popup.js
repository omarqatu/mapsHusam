// js/popup.js

// 🆕 ملاحظة: getRealUserId() أصبحت معرّفة مرة واحدة فقط بملف shared-utils.js
// (window.getRealUserId) بدلاً من تكرارها هنا؛ يجب تحميل shared-utils.js قبل
// هذا الملف. أبقينا اسماً محلياً بنفس التوقيع لتفادي تعديل كل استدعاء بالملف.
const getRealUserId = window.getRealUserId;

// دالة تسجيل حدث/نقرة على الخريطة أو البحث
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

// خريطة تحويل الأسماء العربية إلى الإنجليزية للطبقات
const arabicToEnglishLayerMap = {
    'حواجز الطرق': 'road_barriers',
    'محطات الوقود': 'fuel_stations',
    'فني كهرباء': 'electrician',
    'فني تكييف وتبريد': 'ac_technician',
    'سباك (مواسيرجي)': 'plumber',
    'صيانة عامة': 'general_maintenance',
    'دهان/طراشة': 'painter',
    'فني ديكور': 'Finisher',
    'نجار': 'carpenter',
    'حداد': 'blacksmith',
    'بناء ومعمار': 'builder',
    'خدمات تنظيف': 'house_cleaner',
    'فني ألمنيوم': 'aluminum_tech',
    'فني زجاج وسكريت': 'glass_tech',
    'ميكانيكي سيارات': 'car_mechanic',
    'كهربائي سيارات': 'car_electrician',
    'بنشري / إطارات': 'tire_tech',
    'غسيل سيارات': 'car_wash',
    'صيانة دراجات نارية': 'motorcycle_repair',
    'مكتب تاكسي': 'taxi_driver',
    'خدمات توصيل': 'delivery_services',
    'ونش إنقاذ': 'tow_truck',
    'فني كاميرات مراقبة': 'cctv_installer',
    'منظم حفلات': 'party_planner',
    'فرقة زفة': 'zaffa_bands',
    'فرق موسيقية': 'music_bands',
    'تأجير مستلزمات حفلات': 'party_rental',
    'تمريض منزلي': 'home_nursing',
    'أخصائي مساج': 'massage_therapist',
    'أخصائي حجامة': 'hijama_specialist',
    'أخصائي تغذية': 'nutritionist',
    'سائق شاحنة': 'truck_driver',
    'شركات أمن وحراسة': 'security_companies',
    'شراء أثاث مستعمل': 'used_furniture_buyer',
    'تنسيق حدائق': 'gardener',
    'رعاية حيوانات أليفة': 'pet_care',
    'مهرج وعروض أطفال': 'clown_entertainer',
    'متاجر أون لاين': 'online_stores',
    'فلل أجار': 'villas_rent',
    'فنون قتالية وجمباز': 'martial_arts_gymnastics',
    'حدائق ومناطق ترفيهية': 'public_parks_recreation',
    'فنادق': 'hotels',
    'توزيع أغراض مجاناً': 'free_distribution',
    'حلاقة شباب': 'barber_shop',
    'مصور فوتوغرافي': 'photographers',
    'تصميم فيديو إعلاني': 'video_design_ads',
    'صيدليات مناوبة': 'pharmacies_on_call',
    'تكاسي نظام مناوبة': 'taxis_on_call',
    'طوارئ ومستشفيات': 'emergency_hospitals',
    'عيادات': 'clinics',
    'دكاترة مناوبة': 'doctors_on_call',
    'إسعاف مناوبة': 'ambulance_on_call',
    'تدريب موسيقى ومعاهد': 'music_training',
    'محاميين': 'lawyers',
    'مساحين أراضي': 'land_surveyors',
    'مخمنين عقاريين': 'real_estate_valuers',
    'أساتذة خصوصي': 'private_tutors',
    'مبرمجين': 'programmers',
    'دليفري سيارات (مناوبة)': 'car_delivery_on_call',
    'دليفري دراجات (مناوبة)': 'motorcycle_delivery_on_call',
    'دليفري هوائية (مناوبة)': 'bicycle_delivery_on_call',
    'مساعد أبحاث طلاب': 'student_research_assist',

    'سوبرماركت': 'supermarket',
    'محلات تجارية': 'commercial_shops',
    'مطاعم وكوفي شوبات': 'restaurants',
    'مدارس ورياض أطفال': 'schools_kindergartens',
    'وظائف شاغرة': 'job_vacancies',
    'معالم المدينة': 'city_landmarks'
    

    
};

// دالة جلب التقييمات لمزود خدمة معين
async function fetchRatingsForFeature(serviceLayer, featureId) {
    try {
        // تحويل الاسم العربي إلى الإنجليزي
        const englishLayerName = arabicToEnglishLayerMap[serviceLayer] || serviceLayer;
        
        // إضافة retry mechanism للطلبات الفاشلة
        const maxRetries = 3;
        let retryCount = 0;
        let response;
        
        while (retryCount < maxRetries) {
            try {
                response = await fetch(`${window.location.origin}/api/service-ratings?service_layer=${englishLayerName}&feature_id=${featureId}`);
                if (response.ok) break;
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // تأخير متزايد
                }
            } catch (error) {
                retryCount++;
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
                } else {
                    throw error;
                }
            }
        }
        
        if (!response || !response.ok) {
            throw new Error(`Server error: ${response ? response.status : 'Network error'}`);
        }
        
        const data = await response.json();
        
        if (data.success) {
            const ratingElement = document.getElementById(`rating-text-${serviceLayer}-${featureId}`);
            const ratingContainer = document.getElementById(`rating-display-${serviceLayer}-${featureId}`);
            
            if (ratingElement && ratingContainer) {
                if (data.totalRatings > 0) {
                    const stars = '★'.repeat(Math.round(data.averageRating)) + '☆'.repeat(5 - Math.round(data.averageRating));
                    ratingElement.innerHTML = `<span style="color: #ffc107; font-size: 16px;">${stars}</span> <span style="color: #333; font-weight: bold;">${data.averageRating}</span> <span style="color: #666;">(${data.totalRatings} تقييم)</span>`;
                    
                    // التحقق من عدم وجود زر التعليقات مسبقاً
                    let commentsButton = document.getElementById(`comments-btn-${serviceLayer}-${featureId}`);
                    if (!commentsButton) {
                        // إضافة زر لعرض التعليقات
                        const button = document.createElement('button');
                        button.id = `comments-btn-${serviceLayer}-${featureId}`;
                        button.onclick = () => toggleComments(serviceLayer, featureId);
                        button.style.cssText = 'margin-top: 8px; padding: 4px 8px; background: #1a73e8; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;';
                        button.innerHTML = `💬 عرض التعليقات (${data.totalRatings})`;
                        ratingContainer.appendChild(button);
                        
                        // إضافة حاوية التعليقات
                        const commentsDiv = document.createElement('div');
                        commentsDiv.id = `comments-container-${serviceLayer}-${featureId}`;
                        commentsDiv.style.cssText = 'display: none; margin-top: 10px; max-height: 200px; overflow-y: auto; border-top: 1px solid #eee; padding-top: 8px;';
                        ratingContainer.appendChild(commentsDiv);
                    }
                    
                    // تخزين التقييمات لاستخدامها عند فتح التعليقات
                    window.currentRatings = window.currentRatings || {};
                    window.currentRatings[`${serviceLayer}-${featureId}`] = data.ratings;
                } else {
                    ratingElement.innerHTML = '<span style="color: #999;">لا توجد تقييمات بعد</span>';
                }
            }
        }
    } catch (err) {
        console.warn('فشل جلب التقييمات:', err.message);
    }
}

// دالة عرض/إخفاء التعليقات
window.toggleComments = function(serviceLayer, featureId) {
    const container = document.getElementById(`comments-container-${serviceLayer}-${featureId}`);
    if (!container) return;
    
    if (container.style.display === 'none') {
        container.style.display = 'block';
        const ratings = window.currentRatings?.[`${serviceLayer}-${featureId}`] || [];
        
        if (ratings.length === 0) {
            container.innerHTML = '<div style="color: #999; font-size: 12px;">لا توجد تعليقات</div>';
        } else {
            container.innerHTML = ratings.map(r => `
                <div style="padding: 8px; background: #f9f9f9; border-radius: 4px; margin-bottom: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                        <span style="font-weight: bold; font-size: 12px; color: #333;">${r.user_name || 'مستخدم'}</span>
                        <span style="color: #ffc107; font-size: 14px;">${'★'.repeat(r.rating)}</span>
                    </div>
                    ${r.comment ? `<div style="font-size: 12px; color: #666; line-height: 1.4;">${r.comment}</div>` : ''}
                    <div style="font-size: 10px; color: #999; margin-top: 4px;">${new Date(r.created_at).toLocaleDateString('ar-EG')}</div>
                </div>
            `).join('');
        }
    } else {
        container.style.display = 'none';
    }
};

// 🆕 تطهير نص ليكون صالحاً للاستخدام داخل قيمة سمة HTML (data-attr="...")
function escapeForAttribute(str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
        'حواجز الطرق', 'محطات الوقود',
        'فني كهرباء', 'فني تكييف وتبريد', 'سباك (مواسيرجي)', 'صيانة عامة', 'دهان/طراشة', 'فني ديكور',
        'نجار', 'حداد', 'بناء ومعمار', 'خدمات تنظيف', 'فني ألمنيوم', 'فني زجاج وسكريت', 'ميكانيكي سيارات',
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
         'مساعد أبحاث طلاب',
         
        'سوبرماركت', 'محلات تجارية', 'مطاعم وكوفي شوبات', 'مدارس ورياض أطفال', 'وظائف شاغرة', 'معالم المدينة'
        
    ];

    const realEstateLayerNames = ['شقق الإيجار', 'شقق للبيع', 'الأراضي للبيع'];
    const areaLayerName = 'المناطق';

        function isLayerAllowed(layer, feature) {
        if (!layer) return false;
        const layerKey = Object.keys(window.appLayers).find(key => window.appLayers[key] === layer);

        // 🆕 طبقة الخدمات الموحّدة: التحقق يتم على مستوى المعلم نفسه عبر
        // discriminator، وليس على عنوان الطبقة العام (الذي أصبح "كل الخدمات")
        if (layerKey === 'serviceAllLayer') {
            const discriminator = feature ? feature.get('discriminator') : null;
            if (!discriminator) return false;
            if (MAP_CONFIG.globalExclusions && MAP_CONFIG.globalExclusions.includes(discriminator)) return false;
            return true;
        }

        const layerTitle = layer.get('title');
        const layerBaseName = layerKey ? layerKey.replace('Layer', '') : null;

        return (realEstateLayerNames.includes(layerTitle) || layerTitle === areaLayerName) && (!MAP_CONFIG.globalExclusions || !MAP_CONFIG.globalExclusions.includes(layerBaseName));
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

    const checkRequestQuotaOrAlert = window.checkRequestQuotaOrAlert;

    // 🆕 دالة للتحقق من الفاصل الزمني بين النقرات
    function checkClickCooldown(actionType, featureId, cooldownSeconds = 10) {
        const key = `click_cooldown_${actionType}_${featureId}`;
        const lastClickTime = localStorage.getItem(key);
        const now = Date.now();
        
        if (lastClickTime) {
            const elapsed = (now - parseInt(lastClickTime)) / 1000;
            if (elapsed < cooldownSeconds) {
                const remaining = Math.ceil(cooldownSeconds - elapsed);
                if (window.toast) {
                    window.toast(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى`, 'warning', 3000);
                } else {
                    alert(`يرجى الانتظار ${remaining} ثوانٍ قبل المحاولة مرة أخرى.`);
                }
                return false;
            }
        }
        
        localStorage.setItem(key, now.toString());
        return true;
    }

    window.handlePhoneCall = async function(providerName, localPhone, serviceType, featureId, serviceLayer) {
        const currentUserId = getRealUserId();
        console.log('📞 handlePhoneCall called:', { providerName, localPhone, serviceType, featureId, serviceLayer, userId: currentUserId });
        
        // 🆕 التحقق من الفاصل الزمني
        if (!checkClickCooldown('call', featureId || 'unknown', 10)) {
            return;
        }
        
        const quota = await checkRequestQuotaOrAlert(currentUserId, null);
        if (!quota.allowed) return;

        // 🆕 تسجيل نقرة الاتصال في قاعدة البيانات
        try {
            const response = await fetch(window.location.origin + '/api/log-contact-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    service_layer: serviceLayer,
                    feature_id: featureId,
                    provider_name: providerName,
                    contact_type: 'call'
                })
            });
            const result = await response.json();
            console.log('📞 Contact click logged:', result);
        } catch (err) {
            console.error('خطأ في تسجيل نقرة الاتصال:', err);
        }

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

    window.handleServiceRequest = async function(providerName, whatsappNumber, serviceType, featureId, serviceLayer) {
        const newTab = window.open('', '_blank');

        const currentUserId = getRealUserId();
        console.log('💬 handleServiceRequest called:', { providerName, whatsappNumber, serviceType, featureId, serviceLayer, userId: currentUserId });
        
        // 🆕 التحقق من الفاصل الزمني
        if (!checkClickCooldown('whatsapp', featureId || 'unknown', 10)) {
            if (newTab) newTab.close();
            return;
        }
        
        const quota = await checkRequestQuotaOrAlert(currentUserId, newTab);
        if (!quota.allowed) return;

        // 🆕 تسجيل نقرة الواتساب في قاعدة البيانات
        try {
            const response = await fetch(window.location.origin + '/api/log-contact-click', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: currentUserId,
                    service_layer: serviceLayer,
                    feature_id: featureId,
                    provider_name: providerName,
                    contact_type: 'whatsapp'
                })
            });
            const result = await response.json();
            console.log('💬 Contact click logged:', result);
        } catch (err) {
            console.error('خطأ في تسجيل نقرة الواتساب:', err);
        }

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
        
        let cleanNumber = whatsappNumber.toString().replace(/\D/g, '');

        if (cleanNumber.startsWith('00')) {
            cleanNumber = cleanNumber.substring(2);
        }

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
            if (window.toast) {
                window.toast('لا يمكن نسخ الموقع', 'error');
            } else {
                alert('لا يمكن نسخ الموقع');
            }
            return;
        }

        const baseUrl = window.location.origin + window.location.pathname;
        const params = new URLSearchParams();
        params.set('x', coordinate[0]);
        params.set('y', coordinate[1]);

        const shareLink = `${baseUrl}?${params.toString()}`;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        if (isMobile && navigator.share) {
            navigator.share({
                title: 'موقع على الخريطة',
                url: shareLink
            }).catch(() => {});
            return;
        }

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
                if (window.toast) {
                    window.toast('تم نسخ رابط الموقع بنجاح! يمكنك مشاركته الآن.', 'success');
                } else {
                    alert('تم نسخ رابط الموقع بنجاح! يمكنك مشاركته الآن.');
                }
            } else {
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(shareLink).then(() => {
                        if (window.toast) {
                            window.toast('تم نسخ الرابط بنجاح! يمكنك مشاركته الآن.', 'success');
                        } else {
                            alert('تم نسخ الرابط بنجاح! يمكنك مشاركته الآن.');
                        }
                    }).catch(err => {
                        console.error('فشل نسخ الرابط:', err);
                        if (window.toast) {
                            window.toast('فشل نسخ الرابط. يرجى المحاولة يدوياً.', 'error');
                        } else {
                            alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
                        }
                    });
                } else {
                    if (window.toast) {
                        window.toast('فشل نسخ الرابط. يرجى المحاولة يدوياً.', 'error');
                    } else {
                        alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
                    }
                }
            }
        } catch (err) {
            document.body.removeChild(textarea);
            console.error('فشل نسخ الرابط:', err);
            if (window.toast) {
                window.toast('فشل نسخ الرابط. يرجى المحاولة يدوياً.', 'error');
            } else {
                alert('فشل نسخ الرابط. يرجى المحاولة يدوياً.');
            }
        }
    };
    
    const overlay = new ol.Overlay({
        element: container,
        autoPan: {
            animation: { duration: 250 },
            margin: 40
        },
        positioning: 'bottom-center',
        stopEvent: true,
        offset: [0, -15] 
    });

    overlay.on('change:positioning', function(e) {
        const positioning = overlay.getPositioning();
        container.classList.remove('ol-position-top', 'ol-position-bottom');
        
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

    // 🆕 Event delegation لأزرار الاتصال والواتساب في popup
    container.addEventListener('click', async (e) => {
        console.log('🔍 Popup click event triggered, target:', e.target);
        
        const callBtn = e.target.closest('.popup-call-btn');
        if (callBtn) {
            const providerName = callBtn.dataset.provider;
            const localPhone = callBtn.dataset.phone;
            const serviceType = callBtn.dataset.service;
            const featureId = callBtn.dataset.featureId;
            const serviceLayer = callBtn.dataset.layer;
            console.log('📞 Call button clicked:', { providerName, localPhone, serviceType, featureId, serviceLayer });
            await window.handlePhoneCall(providerName, localPhone, serviceType, featureId, serviceLayer);
            return;
        }

        const whatsappBtn = e.target.closest('.popup-whatsapp-btn');
        if (whatsappBtn) {
            const providerName = whatsappBtn.dataset.provider;
            const whatsappNumber = whatsappBtn.dataset.whatsapp;
            const serviceType = whatsappBtn.dataset.service;
            const featureId = whatsappBtn.dataset.featureId;
            const serviceLayer = whatsappBtn.dataset.layer;
            console.log('💬 WhatsApp button clicked:', { providerName, whatsappNumber, serviceType, featureId, serviceLayer });
            await window.handleServiceRequest(providerName, whatsappNumber, serviceType, featureId, serviceLayer);
            return;
        }
    });

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

        // 🆕 تحديد اسم الطبقة الحقيقي: للخدمات (بعد الدمج) من discriminator
        // المعلم نفسه عبر قاموس window.serviceSubtypes، وللعقارات/المناطق
        // من عنوان الطبقة كالمعتاد (لم يتغيروا)
        const rawLayerTitle = layer ? (layer.get('title') || 'معلم') : 'معلم';
        const discriminator = feature.get('discriminator') || null;
        const isServiceAllLayer = !!discriminator && window.serviceSubtypes && window.serviceSubtypes[discriminator];

        const layerTitle = isServiceAllLayer ? window.serviceSubtypes[discriminator].title : rawLayerTitle;
        // 🆕 الاسم الإنجليزي أصبح ببساطة قيمة discriminator نفسها لكل الخدمات
        const layerEnglishName = isServiceAllLayer ? discriminator : (layer ? (layer.get('name') || arabicToEnglishLayerMap[layerTitle] || layerTitle) : layerTitle);

        const isRealEstate = realEstateLayerNames.includes(layerTitle);
        const isService = isServiceAllLayer;
        const isAreaLayer = layerTitle === areaLayerName; 
        const isRoadBarriers = discriminator === 'road_barriers';

        let displayFeatureId = null;
        if (isRealEstate) {
            displayFeatureId = (props.fid !== undefined && props.fid !== null && props.fid !== '') ? props.fid : null;
        } else if (isService) {
            // محاولة عدة حقول للمعرف
            displayFeatureId = (props.id !== undefined && props.id !== null && props.id !== '') ? props.id : null;
            if (!displayFeatureId) {
                displayFeatureId = (props.fid !== undefined && props.fid !== null && props.fid !== '') ? props.fid : null;
            }
            if (!displayFeatureId) {
                displayFeatureId = (props.feature_id !== undefined && props.feature_id !== null && props.feature_id !== '') ? props.feature_id : null;
            }
        }
        
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

        let bodyHtml = `<div class="popup-body" style="font-size: 13px; line-height: 1.6;  overflow-y:auto; padding-right:5px; direction: rtl; text-align: right;">`;
        bodyHtml += `<div style="margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 5px;"><b style="color: #007bff;">🛠️ التصنيف:</b> <b>${layerTitle}</b>${displayFeatureId !== null ? ` <span style="color:#888; font-size:12px;">(رقم: ${window.sanitizeHTML(String(displayFeatureId))})</span>` : ''}</div>`;
        
        // إضافة عرض النجوم للخدمات فقط (باستثناء حواجز الطرق - لا تقييمات لها)
        if (isService && displayFeatureId && !isRoadBarriers) {
            // استخدام الاسم الإنجليزي من layer مباشرة لقاعدة البيانات
            const layerDbName = layerEnglishName;
            if (layerDbName) {
                bodyHtml += `<div id="rating-display-${layerDbName}-${displayFeatureId}" style="margin-bottom: 8px; padding: 8px; background: #fff9e6; border-radius: 6px; border: 1px solid #ffe082;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 14px; color: #f57c00;">⭐</span>
                        <span id="rating-text-${layerDbName}-${displayFeatureId}" style="font-size: 12px; color: #666;">جاري تحميل التقييم...</span>
                    </div>
                </div>`;
                
                // جلب التقييم بشكل غير متزامن
                fetchRatingsForFeature(layerDbName, displayFeatureId);
            }
        }
        
                if (!isAreaLayer && !isRoadBarriers) bodyHtml += getStatusHtml(props.auto_status, props.work_hours);

                if (isRoadBarriers) {
            const stopInfo = window.getRoadBarrierStopInfo(window.getCaseInsensitiveProp(props, 'stop'));
            bodyHtml += `<div style="margin: 10px 0; padding: 10px; border-radius: 8px; background: ${stopInfo.color}15; border: 1px dashed ${stopInfo.color}; text-align: center;">
                <span style="color: ${stopInfo.color}; font-weight: bold; font-size: 15px;">${stopInfo.icon} ${stopInfo.label}</span>
            </div>`;
            if (props.name) bodyHtml += `<b>📍 الاسم:</b> ${window.sanitizeHTML(props.name)}<br>`;
            // 🆕 عرض المحافظة والمدينة والموقع
            if (props.gov_a) bodyHtml += `<b>🌍 المحافظة:</b> ${window.sanitizeHTML(props.gov_a)}<br>`;
            if (props.village_a) bodyHtml += `<b>🏘️ المدينة:</b> ${window.sanitizeHTML(props.village_a)}<br>`;
            if (props.location_name || props.location) bodyHtml += `<b>📍 الموقع:</b> ${window.sanitizeHTML(props.location_name || props.location)}<br>`;

            bodyHtml += `
            <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                <button onclick="copyLocationLink(window.currentPopupCoordinate)"
                        style="width: 100%; background: #6c757d; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; box-shadow: 0 4px 12px rgba(108,117,125,0.3);">
                    <i class="fas fa-link" style="font-size: 14px;"></i> نسخ رابط الموقع
                </button>
            </div>`;
                } else if (isRealEstate || isService) {
            if (props.name) bodyHtml += `<b>👤 الاسم:</b> ${window.sanitizeHTML(props.name)}<br>`;
            if (props.location_name || props.location) bodyHtml += `<b>📍 الموقع:</b> ${window.sanitizeHTML(props.location_name || props.location)}<br>`;

            if (layerTitle === 'محطات الوقود') {
                bodyHtml += window.buildFuelAvailabilityHtml(props);
            }

            if (isRealEstate) {
                if (props.price) bodyHtml += `<b>💰 السعر:</b> ${Number(props.price).toLocaleString()} ${getCurrencySymbol(props.currency)}<br>`;
                if (props.area) bodyHtml += `<b>📐 المساحة:</b> ${props.area} م²<br>`;
                if (props.village_a) bodyHtml += `<b>🏘️ البلدة:</b> ${window.sanitizeHTML(props.village_a)}<br>`;
                if (props.gov_a) bodyHtml += `<b>🌍 المحافظة:</b> ${window.sanitizeHTML(props.gov_a)}<br>`;
                if (props.des) bodyHtml += `<div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px; word-wrap:break-word; overflow-wrap:break-word; white-space:normal;"><b>📝 الوصف:</b> ${window.sanitizeHTML(props.des)}</div>`;
                
            } 

            if (props.des && !isRealEstate) bodyHtml += `<div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px; word-wrap:break-word; overflow-wrap:break-word; white-space:normal;"><b>📝 الوصف:</b> ${props.des}</div>`;
            
            if (props.whatsapp) {
                const whatsappNumber = props.whatsapp.toString();
                const providerName = props.name || (isRealEstate ? "المعلن" : "مزود الخدمة");

                // 🆕 [عرض ذكي حسب ارتباط الخدمة بحساب مزود فعلي]: العقارات تبقى
                
                let layerDbName = layerEnglishName || '';
                let isLinkedProvider = false;
                if (isService) {
                    isLinkedProvider = typeof window.isFeatureLinkedToProvider === 'function' && window.isFeatureLinkedToProvider(layerDbName, displayFeatureId);
                }

                if (isService && isLinkedProvider) {
                    const providerWhatsapp = props.whatsapp ? props.whatsapp.toString() : '';
                    const providerPhone = props.phone ? props.phone.toString() : '';

                    bodyHtml += `
                    <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                        <button class="req-svc-btn"
                                data-provider="${escapeForAttribute(providerName)}"
                                data-service="${escapeForAttribute(layerTitle)}"
                                data-layer="${escapeForAttribute(layerDbName)}"
                                data-feature-id="${escapeForAttribute(displayFeatureId)}"
                                data-whatsapp="${escapeForAttribute(providerWhatsapp)}"
                                data-phone="${escapeForAttribute(providerPhone)}"
                                style="width: 100%; background: linear-gradient(135deg, #1a73e8, #6c5ce7); color: white; border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 13px; box-shadow: 0 4px 12px rgba(26,115,232,0.3);">
                            <i class="fas fa-paper-plane" style="font-size: 15px;"></i> طلب الخدمة
                        </button>
                    </div>`;
                } else {
                    // 🆕 زر الاتصال يظهر فقط إذا كان هناك phone
                    const hasPhone = props.phone !== undefined && props.phone !== null && props.phone !== '' && String(props.phone).trim() !== '';
                    const localPhone = hasPhone ? String(props.phone) : ('0' + whatsappNumber.replace(/\D/g, '').slice(5));

                    bodyHtml += `
                    <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                            ${hasPhone ? `
                                                        <button class="popup-call-btn" 
                                    data-provider="${escapeForAttribute(providerName)}" 
                                    data-phone="${escapeForAttribute(localPhone)}" 
                                    data-service="${escapeForAttribute(layerTitle)}" 
                                    data-feature-id="${escapeForAttribute(String(displayFeatureId || ''))}" 
                                    data-layer="${escapeForAttribute(layerDbName || layerEnglishName || '')}"
                                    style="flex: 1; background: #1a73e8; color: white; border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; box-shadow: 0 4px 12px rgba(26,115,232,0.3);">
                                <i class="fas fa-mobile-alt" style="font-size: 16px;"></i> اتصال <span dir="ltr">${window.sanitizeHTML(localPhone)}</span>
                            </button>` : ''}
                            <button class="popup-whatsapp-btn" 
                                    data-provider="${escapeForAttribute(providerName)}" 
                                    data-whatsapp="${escapeForAttribute(whatsappNumber)}" 
                                    data-service="${escapeForAttribute(layerTitle)}" 
                                    data-feature-id="${escapeForAttribute(String(displayFeatureId || ''))}" 
                                    data-layer="${escapeForAttribute(layerDbName || layerEnglishName || '')}"
                                    style="flex: ${hasPhone ? '1' : '1'}; background: #25d366; color: white; border: none; padding: 12px 8px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 13px; box-shadow: 0 4px 12px rgba(37,211,102,0.3);">
                                <i class="fab fa-whatsapp" style="font-size: 16px;"></i> واتساب
                            </button>
                        </div>
                    </div>`;
                }
            }

            bodyHtml += `
            <div style="margin-top: 15px; border-top: 2px solid #eee; padding-top: 12px;">
                <button onclick="copyLocationLink(window.currentPopupCoordinate)"
                        style="width: 100%; background: #6c757d; color: white; border: none; padding: 10px; border-radius: 10px; cursor: pointer; font-weight: bold; display: flex; align-items: center; justify-content: center; gap: 6px; font-size: 12px; box-shadow: 0 4px 12px rgba(108,117,125,0.3);">
                    <i class="fas fa-link" style="font-size: 14px;"></i> نسخ رابط الموقع
                </button>
            </div>`;

            if (props.details_link_1 || props.pic || props.video) {
            if (props.details_link_1) bodyHtml += `<div style="margin-top:8px;">🔗 ${createLink(props.details_link_1, "تفاصيل إضافية")}</div>`;
            if (props.video) bodyHtml += `<div style="margin-top:8px;">🎥 ${createLink(props.video, "عرض الفيديو")}</div>`;
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
            if (isLayerAllowed(layer, feature)) {
                featureFound = true;
                window.currentPopupCoordinate = event.coordinate;
                content.innerHTML = window.generateFeatureHtml(feature, layer);
                overlay.setPosition(event.coordinate);
                isPopupPinned = true;

                // 🆕 اسم الطبقة الحقيقي للتسجيل: من discriminator المعلم عبر
                // serviceSubtypes للخدمات، أو عنوان الطبقة العادي للعقارات/المناطق
                const featureDiscriminator = feature.get('discriminator');
                const layerTitle = (featureDiscriminator && window.serviceSubtypes && window.serviceSubtypes[featureDiscriminator])
                    ? window.serviceSubtypes[featureDiscriminator].title
                    : (layer.get('title') || 'معلم');
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
            if (isLayerAllowed(layer, feature)) {
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

    function openLocationFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const x = urlParams.get('x');
        const y = urlParams.get('y');

        if (!x || !y) return;

        const coordinate = [parseFloat(x), parseFloat(y)];

        if (isNaN(coordinate[0]) || isNaN(coordinate[1])) return;

        map.getView().animate({
            center: coordinate,
            zoom: 19,
            duration: 1000
        });

        window.currentPopupCoordinate = coordinate;
        content.innerHTML = `<div style="padding:10px; text-align:center;">
            <strong>📍 الموقع المشارك</strong><br>
            <small>تم توجيهك إلى هذا الموقع</small>
        </div>`;
        overlay.setPosition(coordinate);
        isPopupPinned = true;
    }

    setTimeout(openLocationFromUrl, 1000);
}
// لعرض في صفحه البحث بدون خريطة
document.addEventListener('DOMContentLoaded', function () {
    async function loadAllTopRatedAdsFixed() {
        // 🆕 صفحة البحث بدون خريطة أصبحت تدير إعلاناتها بنفسها (كود موحّد
        // يشمل العقارات والخدمات معاً) - لا داعي لتشغيل هذه النسخة القديمة
        // معها لتفادي التعارض المزدوج على نفس عناصر .nms-ad-space
        if (window.__nmsPageHandlesOwnAds) return;

        const adSpaces = document.querySelectorAll('.nms-ad-space');
        if (!adSpaces.length) return;

        let allValidCards = [];

        try {
            const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
            let allTargets = [];

            // 1. استخدام الطبقات الجديدة الستة فقط في البوب أب
            const newLayers = [
                { layer: 'supermarket', workspace: 'services', label: 'سوبرماركت' },
                { layer: 'commercial_shops', workspace: 'services', label: 'محلات تجارية' },
                { layer: 'restaurants', workspace: 'services', label: 'مطاعم وكوفي شوبات' },
                { layer: 'schools_kindergartens', workspace: 'services', label: 'مدارس ورياض أطفال' },
                { layer: 'job_vacancies', workspace: 'services', label: 'وظائف شاغرة' },
                { layer: 'city_landmarks', workspace: 'services', label: 'معالم المدينة' }
            ];
            allTargets.push(...newLayers);

            // 3. جلب البيانات على دفعات لتحسين الأداء
            const batchSize = 10;
            for (let i = 0; i < allTargets.length; i += batchSize) {
                const batch = allTargets.slice(i, i + batchSize);
                
                const promises = batch.map(async (item) => {
                    try {
                        const params = new URLSearchParams({
                            layer: item.layer,
                            workspace: item.workspace,
                            field_0: 'rating',
                            operator_0: '=',
                            value_0: '10',
                            conditions_count: '1'
                        });

                        const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                        if (!response.ok) return [];
                        
                        const data = await response.json();
                        const features = data.features || (Array.isArray(data) ? data : []);
                        
                        return features.map(rawFeat => {
                            const props = rawFeat.properties || rawFeat;
                            const titleText = props.name || props.title || '';
                            const locationText = props.city || props.location || '';
                            
                            return `
                                <div style="background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 10px; margin-bottom: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
                                        <span style="background: #e3f2fd; color: #1976d2; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                                            📌 ${item.label}
                                        </span>
                                    </div>
                                    ${titleText ? `<div style="font-weight: bold; color: #202124; font-size: 12px; margin-bottom: 4px; word-break: break-word;">${titleText}</div>` : ''}
                                    ${locationText ? `<div style="color: #555; font-size: 11px; margin-bottom: 3px; word-break: break-word;">📍 ${locationText}</div>` : ''}
                            `;
                        });
                    } catch (err) {
                        return [];
                    }
                });

                const results = await Promise.all(promises);
                results.forEach(cards => {
                    if (cards && cards.length > 0) {
                        allValidCards.push(...cards);
                    }
                });
            }

        } catch (e) {
            console.error('خطأ عام في جلب الإعلانات:', e);
        }

        // دالة خلط المصفوفة عشوائياً
        function shuffleArray(array) {
            let arr = [...array];
            for (let i = arr.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [arr[i], arr[j]] = [arr[j], arr[i]];
            }
            return arr;
        }

        // توزيع الإعلانات بمسافات متساوية وتعبئة كامل الفراغات (جانبية وسفلية)
        adSpaces.forEach((space) => {
            space.innerHTML = '';

            if (allValidCards.length === 0) {
                space.innerHTML = `<div style="padding: 10px; text-align: center; font-size: 11px; color: #777;">لا توجد إعلانات مميزة</div>`;
                return;
            }

            const randomizedCards = shuffleArray(allValidCards);
            const selectedCards = randomizedCards.slice(0, 4); // 4 إعلانات لكل جهة

            if (space.classList.contains('nms-ad-bottom')) {
                // المساحة السفلية (أفقية)
                space.style.display = 'flex';
                space.style.flexWrap = 'wrap';
                space.style.gap = '10px';
                space.style.justifyContent = 'center';
                space.style.alignItems = 'stretch';
                space.style.width = '100%';
                space.style.minHeight = '100%';
                space.style.boxSizing = 'border-box';
                const styledCards = selectedCards.map(card => card.replace('width: 100%;', 'width: 24%; min-width: 240px;'));
                space.innerHTML = styledCards.join('');
            } else {
                // المساحات الجانبية (يمين ويسار): عمودية مع تباعد باستخدام gap لضمان المسافات
                space.style.display = 'flex';
                space.style.flexDirection = 'column';
                space.style.gap = '10px';
                space.style.width = '100%';
                space.style.minHeight = '100%';
                space.style.boxSizing = 'border-box';
                space.style.padding = '10px 0';
                space.innerHTML = selectedCards.join('');
            }
        });
    }

    setTimeout(loadAllTopRatedAdsFixed, 1000);
});