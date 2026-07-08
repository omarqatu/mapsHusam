// js/share-location.js

function initializeShareLocationTools(map) {
    let shareLayer;
    let clickListener = null;

    // جلب العناصر من الواجهة
    const shareLinkInput = document.getElementById('share-link-input');
    const copyBtn = document.getElementById('copy-share-link-btn');
    const display = document.getElementById('shared-location-display');
    const clearBtn = document.getElementById('clear-share-location-btn');
    
    // عناصر عرض الإحداثيات
    const palDisplay = document.getElementById('pal-coords-text');
    const wgsDisplay = document.getElementById('wgs-coords-text');

    // دالة إنشاء الطبقة (مرة واحدة)
    function initLayer() {
        if (!shareLayer) {
            shareLayer = new ol.layer.Vector({
                source: new ol.source.Vector(),
                style: new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 1],
                        // أيقونة دبوس حمراء احترافية
                        src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
                        scale: 0.07
                    })
                }),
                zIndex: 10000 // لضمان ظهورها فوق كل شيء
            });
            map.addLayer(shareLayer);
        }
    }

    // دالة معالجة النقر على الخريطة
    function handleMapClick(e) {
        // التأكد من أن لوحة المشاركة مفتوحة قبل معالجة النقر
        const panel = document.getElementById('shareLocationPanel');
        if (panel && panel.classList.contains('hidden')) return;

        const coords = e.coordinate; 
        initLayer(); // التأكد من وجود الطبقة
        shareLayer.getSource().clear();
        
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(coords)
        });
        shareLayer.getSource().addFeature(feature);

        // 1. عرض الإحداثيات الفلسطينية Palestine Grid
        if (palDisplay) {
            palDisplay.innerText = `E: ${coords[0].toFixed(3)} , N: ${coords[1].toFixed(3)}`;
        }

        // 2. التحويل إلى الإحداثيات العالمية (WGS84)
        try {
            const lonLat = ol.proj.transform(coords, 'EPSG:28191', 'EPSG:4326');
            if (wgsDisplay) {
                wgsDisplay.innerText = `Lat: ${lonLat[1].toFixed(6)} , Lon: ${lonLat[0].toFixed(6)}`;
            }
        } catch (err) {
            console.error("خطأ في تحويل الإحداثيات:", err);
        }

        // 3. إنشاء الرابط ومشاركته
        const zoom = map.getView().getZoom();
        const baseUrl = window.location.origin + window.location.pathname;
        const url = `${baseUrl}?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}&z=${zoom.toFixed(0)}`;

        if (shareLinkInput) shareLinkInput.value = url;
        if (display) display.innerText = `تم تحديد الموقع بنجاح:`;
    }

    // تفعيل/تعطيل أداة النقر بناءً على حالة اللوحة
    // سنقوم بإنشاء دالة عالمية ليتم استدعاؤها من main.js عند تبديل اللوحة
    window.toggleShareLocationTool = function(active) {
        if (active) {
            initLayer();
            if (!clickListener) {
                clickListener = map.on('singleclick', handleMapClick);
                map.getTargetElement().style.cursor = 'crosshair';
            }
        } else {
            if (clickListener) {
                ol.Observable.unByKey(clickListener);
                clickListener = null;
                map.getTargetElement().style.cursor = '';
            }
        }
    };

    // مراقب التغييرات (MutationObserver) لضمان العمل التلقائي
    const observer = new MutationObserver(() => {
        const panel = document.getElementById('shareLocationPanel');
        if (panel) {
            const isActive = !panel.classList.contains('hidden');
            window.toggleShareLocationTool(isActive);
        }
    });

    const targetPanel = document.getElementById('shareLocationPanel');
    if (targetPanel) {
        observer.observe(targetPanel, { attributes: true, attributeFilter: ['class'] });
    }

// برمجة زر النسخ
    copyBtn?.addEventListener('click', async () => {
        if (!shareLinkInput || !shareLinkInput.value) {
            alert("يرجى تحديد موقع على الخريطة أولاً.");
            return;
        }

        const urlToCopy = shareLinkInput.value;
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

        // 📱 على الموبايل: استخدام قائمة المشاركة الأصلية لتفادي مشكلة تحويل الرابط لبحث جوجل عند اللصق
        if (isMobile && navigator.share) {
            try {
                await navigator.share({
                    title: 'موقع مشارك على الخريطة',
                    url: urlToCopy
                });
            } catch (e) {
                // المستخدم ألغى المشاركة، لا حاجة لفعل شيء
            }
            return;
        }

        // 💻 على الكمبيوتر: نفس منطق النسخ القديم
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(urlToCopy);
                showCopySuccess();
            } else {
                shareLinkInput.select();
                shareLinkInput.setSelectionRange(0, 99999);
                const successful = document.execCommand('copy');
                if (successful) {
                    showCopySuccess();
                } else {
                    throw new Error('فشل النسخ');
                }
            }
        } catch (err) {
            console.error('خطأ في النسخ:', err);
            alert('فشل نسخ الرابط. يرجى نسخه يدوياً.');
        }

        function showCopySuccess() {
            const originalText = copyBtn.innerHTML;
            copyBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
            copyBtn.classList.replace('btn-primary', 'btn-success');

            setTimeout(() => {
                copyBtn.innerHTML = originalText;
                copyBtn.classList.replace('btn-success', 'btn-primary');
            }, 2000);
        }
    });
    // برمجة زر نسخ الإحداثيات الفلسطينية
    const copyPalBtn = document.getElementById('copy-pal-coords-btn');
    copyPalBtn?.addEventListener('click', async () => {
        const coordsText = palDisplay?.innerText;
        if (!coordsText || coordsText.includes('---')) {
            alert('يرجى تحديد موقع على الخريطة أولاً.');
            return;
        }

        // تنسيق الإحداثيات الفلسطينية لـ ArcGIS Pro: E,N
        const coords = coordsText.replace('E: ', '').replace('N: ', '').replace(' , ', ',');
        const formattedCoords = coords; // Format: 169000,145000

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(formattedCoords);
                const originalText = copyPalBtn.innerHTML;
                copyPalBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
                setTimeout(() => { copyPalBtn.innerHTML = originalText; }, 2000);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = formattedCoords;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                const originalText = copyPalBtn.innerHTML;
                copyPalBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
                setTimeout(() => { copyPalBtn.innerHTML = originalText; }, 2000);
            }
        } catch (err) {
            console.error('خطأ في النسخ:', err);
            alert('فشل نسخ الإحداثيات.');
        }
    });

    // برمجة زر نسخ الإحداثيات العالمية
    const copyWgsBtn = document.getElementById('copy-wgs-coords-btn');
    copyWgsBtn?.addEventListener('click', async () => {
        const coordsText = wgsDisplay?.innerText;
        if (!coordsText || coordsText.includes('---')) {
            alert('يرجى تحديد موقع على الخريطة أولاً.');
            return;
        }

        // تنسيق الإحداثيات العالمية لـ Google Maps: lat,lon
        const coords = coordsText.replace('Lat: ', '').replace('Lon: ', '').replace(' , ', ',');
        const formattedCoords = coords; // Format: 31.952,35.233

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(formattedCoords);
                const originalText = copyWgsBtn.innerHTML;
                copyWgsBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
                setTimeout(() => { copyWgsBtn.innerHTML = originalText; }, 2000);
            } else {
                const textarea = document.createElement('textarea');
                textarea.value = formattedCoords;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                const originalText = copyWgsBtn.innerHTML;
                copyWgsBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
                setTimeout(() => { copyWgsBtn.innerHTML = originalText; }, 2000);
            }
        } catch (err) {
            console.error('خطأ في النسخ:', err);
            alert('فشل نسخ الإحداثيات.');
        }
    });

    // برمجة زر الانتقال إلى Google Maps
    const openGoogleMapsBtn = document.getElementById('open-google-maps-btn');
    openGoogleMapsBtn?.addEventListener('click', () => {
        const coordsText = wgsDisplay?.innerText;
        if (!coordsText || coordsText.includes('---')) {
            alert('يرجى تحديد موقع على الخريطة أولاً.');
            return;
        }

        // استخراج الإحداثيات من النص
        const coords = coordsText.replace('Lat: ', '').replace('Lon: ', '').replace(' , ', ',');
        const [lat, lon] = coords.split(',');

        // فتح Google Maps في نافذة جديدة
        const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
        window.open(googleMapsUrl, '_blank');
    });

    // برمجة زر المسح (إلغاء التحديد)
    clearBtn?.addEventListener('click', () => {
        shareLayer?.getSource().clear();
        if (shareLinkInput) shareLinkInput.value = '';
        if (palDisplay) palDisplay.innerText = 'E: --- , N: ---';
        if (wgsDisplay) wgsDisplay.innerText = 'Lat: --- , Lon: ---';
        if (display) display.innerText = 'انقر على الخريطة لتحديد موقع ومشاركته.';
    });

    // فحص الرابط عند تشغيل الصفحة (إذا كان شخص قد أرسل لك رابطاً)
    function checkUrl() {
        const params = new URLSearchParams(window.location.search);
        const x = parseFloat(params.get('x'));
        const y = parseFloat(params.get('y'));
        const z = parseFloat(params.get('z'));

        if (!isNaN(x) && !isNaN(y)) {
            initLayer();
            const view = map.getView();
            
            // تحريك الخريطة للموقع المشترك
            view.setCenter([x, y]);
            if (!isNaN(z)) view.setZoom(z);

            const feature = new ol.Feature({ geometry: new ol.geom.Point([x, y]) });
            shareLayer.getSource().addFeature(feature);
            
            // تحديث واجهة العرض
            if (palDisplay) palDisplay.innerText = `E: ${x.toFixed(3)} , N: ${y.toFixed(3)}`;
            try {
                const lonLat = ol.proj.transform([x, y], 'EPSG:28191', 'EPSG:4326');
                if (wgsDisplay) wgsDisplay.innerText = `Lat: ${lonLat[1].toFixed(6)} , Lon: ${lonLat[0].toFixed(6)}`;
            } catch(e) {}
            
            if (display) display.innerText = "عرض الموقع المستلم من الرابط:";
        }
    }

    // تشغيل فحص الرابط فوراً
    checkUrl();
}
