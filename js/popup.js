// js/popup.js

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

    // الحالة الافتراضية: الاستعلام مفعّل عند بداية التشغيل
    let isPopupEnabled = true; 
    let isPopupPinned = false; 
    
    // تحديث شكل الزر ليعكس الحالة المفعّلة في البداية
    togglePopupBtn.classList.add('active-tool'); // تأكد من وجود تنسيق لهذا الكلاس في CSS
    togglePopupBtn.style.backgroundColor = "#e1f5fe"; // تمييز بصري بسيط

    // دالة لتنظيف الروابط
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

    function createLink(url, text = "للتفاصيل انقر هنا", isWhatsapp = false) {
        const validatedUrl = cleanUrl(url);
        if (!validatedUrl) return '';
        let finalUrl = validatedUrl;
        if (isWhatsapp) {
            let cleanNumber = finalUrl.replace(/\D/g, '');
            if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);
            finalUrl = `https://wa.me/${cleanNumber}`;
            text = "اضغط للمراسلة (واتساب)";
        } else if (!finalUrl.startsWith('http')) {
            finalUrl = 'https://' + finalUrl;
        }
        return `<a href="${finalUrl}" target="_blank" class="popup-link">${text}</a>`;
    }

    function createImageElement(url) {
        const validatedUrl = cleanUrl(url);
        if (!validatedUrl) return '';
        return `<div class="popup-img-container" style="margin-top:10px; text-align:center;">
                    <img src="${validatedUrl}" class="popup-img" style="max-width:100%; border-radius:8px; display:block; margin:auto;" onerror="this.style.display='none'">
                </div>`;
    }

    const overlay = new ol.Overlay({
        element: container,
        autoPan: { animation: { duration: 250 } },
        positioning: 'bottom-center',
        offset: [0, 0]
    });
    map.addOverlay(overlay);
    
    // إتاحة وظيفة تعطيل البوب أب عالمياً لاستخدامها في ملف التحرير
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

    // التحكم في الزر (ON/OFF)
    togglePopupBtn.onclick = function() {
        window.setPopupState(!isPopupEnabled);
    };

    function createPopupContent(feature, layer) {
        const props = feature.getProperties();
        const layerTitle = layer ? (layer.get('title') || 'معلم') : 'معلم';
        const headerName = props.name || props.location_name || props.location || "تفاصيل المعلم";
        
        popupTitle.innerHTML = `<span class="popup-header-title">${headerName}</span>`; 

        let bodyHtml = `<div class="popup-body" style="font-size: 13px; line-height: 1.6; max-height:300px; overflow-y:auto;">`;
        bodyHtml += `<div style="margin-bottom: 8px; border-bottom: 1px solid #eee;"><b style="color: #007bff;">🛠️ التصنيف:</b> <b>${layerTitle}</b></div>`;

        const isRealEstate = layerTitle.includes('شقق') || layerTitle.includes('أراضي') || layerTitle.includes('عقار') || layerTitle.includes('بيع') || layerTitle.includes('ايجار');

        if (isRealEstate) {
            if (props.location) bodyHtml += `<b>📍 الموقع:</b> ${props.location}<br>`;
            if (props.price) bodyHtml += `<b>💰 السعر:</b> ${props.price}<br>`;
            if (props.area) bodyHtml += `<b>📐 المساحة:</b> ${props.area} م²<br>`;
            if (props.village_a) bodyHtml += `<b>🏘️ البلدة:</b> ${props.village_a}<br>`;
            if (props.gov_a) bodyHtml += `<b>🌍 المحافظة:</b> ${props.gov_a}<br>`;
            if (props.des) bodyHtml += `<div style="margin-top:5px; background:#f9f9f9; padding:5px; border-radius:4px;"><b>📝 الوصف:</b> ${props.des}</div>`;
            
            if (props.video) bodyHtml += `<div style="margin-top:8px;">🎥 ${createLink(props.video, "عرض الفيديو")}</div>`;
            // إظهار الصورة (pic) للعقارات
            if (props.pic) bodyHtml += `<div style="margin-top:8px;">🎥 ${createLink(props.pic, "عرض أكثر")}</div>`;


        } else {
            if (props.name) bodyHtml += `<b>👤 الاسم:</b> ${props.name}<br>`;
            if (props.location_name) bodyHtml += `<b>📍 المكان:</b> ${props.location_name}<br>`;
            if (props.whatsapp) bodyHtml += `<b>💬 واتساب:</b> ${createLink(props.whatsapp, "", true)}<br>`;
            if (props.rating) bodyHtml += `<b>⭐ التقييم:</b> ${props.rating} / 5<br>`;
            
            if (props.details_link_1) bodyHtml += `<div style="margin-top:8px;">🔗 ${createLink(props.details_link_1, "تفاصيل إضافية")}</div>`;
            if (props.pic) bodyHtml += `<hr>${createImageElement(props.pic)}`;
        }

        bodyHtml += `</div>`;
        return bodyHtml;
    }

    window.hideFeaturePopup = function() {
        overlay.setPosition(undefined);
        isPopupPinned = false;
    };

    closer.onclick = function() {
        window.hideFeaturePopup();
        return false;
    };

    // الاستجابة للنقر
    map.on('singleclick', function(event) {
        if (!isPopupEnabled) return; // لا تفعل شيء إذا كان الاستعلام معطلاً

        let featureFound = false;
        map.forEachFeatureAtPixel(event.pixel, function(feature, layer) {
            if (layer && layer.get('title')) {
                featureFound = true;
                content.innerHTML = createPopupContent(feature, layer);
                overlay.setPosition(event.coordinate);
                isPopupPinned = true;
                return true; 
            }
        });
        if (!featureFound) window.hideFeaturePopup();
    });

    // الاستجابة لتحريك الماوس (Hover)
    map.on('pointermove', function(event) {
        if (!isPopupEnabled || isPopupPinned || event.dragging) return;
        
        const pixel = map.getEventPixel(event.originalEvent);
        let featureFound = false;
        
        map.forEachFeatureAtPixel(pixel, function(feature, layer) {
            if (layer && layer.get('title')) {
                featureFound = true;
                content.innerHTML = createPopupContent(feature, layer);
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
}