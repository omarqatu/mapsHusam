// js/share-location.js

function initializeShareLocationTools(map) {
    let shareLayer;
    let clickListener;

    const shareLinkInput = document.getElementById('share-link-input');
    const copyBtn = document.getElementById('copy-share-link-btn');
    const display = document.getElementById('shared-location-display');
    const clearBtn = document.getElementById('clear-share-location-btn');
    
    // عناصر عرض الإحداثيات الجديدة
    const palDisplay = document.getElementById('pal-coords-text');
    const wgsDisplay = document.getElementById('wgs-coords-text');

    function initLayer() {
        if (!shareLayer) {
            shareLayer = new ol.layer.Vector({
                source: new ol.source.Vector(),
                style: new ol.style.Style({
                    image: new ol.style.Icon({
                        anchor: [0.5, 1],
                        src: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
                        scale: 0.07
                    })
                }),
                zIndex: 9999
            });
            map.addLayer(shareLayer);
        }
    }

    function handleMapClick(e) {
        const coords = e.coordinate; // هذه إحداثيات فلسطينية 28191 لأن الخريطة تعمل بهذا المسقط
        shareLayer.getSource().clear();
        
        const feature = new ol.Feature({
            geometry: new ol.geom.Point(coords)
        });
        shareLayer.getSource().addFeature(feature);

        // 1. عرض الإحداثيات الفلسطينية (بدقة 3 خانات)
        palDisplay.innerText = `E: ${coords[0].toFixed(3)} , N: ${coords[1].toFixed(3)}`;

        // 2. التحويل إلى الإحداثيات العالمية (WGS84)
        // نقوم بالتحويل من مسقط الخريطة الحالي إلى EPSG:4326
        const lonLat = ol.proj.transform(coords, 'EPSG:28191', 'EPSG:4326');
        // ملاحظة: lonLat[0] هو خط الطول و lonLat[1] هو خط العرض
        wgsDisplay.innerText = `Lat (العرض): ${lonLat[1].toFixed(6)} , Lon (الطول): ${lonLat[0].toFixed(6)}`;

        // 3. إنشاء الرابط
        const zoom = map.getView().getZoom();
        const baseUrl = window.location.origin + window.location.pathname;
        const url = `${baseUrl}?x=${coords[0].toFixed(3)}&y=${coords[1].toFixed(3)}&z=${zoom.toFixed(0)}`;

        shareLinkInput.value = url;
        display.innerText = `تم تحديد الموقع بنجاح:`;
    }

    // مراقب فتح اللوحة
    const observer = new MutationObserver(() => {
        const panel = document.getElementById('shareLocationPanel');
        if (!panel.classList.contains('hidden')) {
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
    });

    observer.observe(document.getElementById('shareLocationPanel'), { attributes: true });

    // زر النسخ
    copyBtn?.addEventListener('click', () => {
        if (!shareLinkInput.value) return;
        shareLinkInput.select();
        navigator.clipboard.writeText(shareLinkInput.value);
        
        const originalText = copyBtn.innerHTML;
        copyBtn.innerHTML = '<i class="fas fa-check"></i> تم النسخ!';
        setTimeout(() => { copyBtn.innerHTML = originalText; }, 2000);
    });

    // زر المسح
    clearBtn?.addEventListener('click', () => {
        shareLayer?.getSource().clear();
        shareLinkInput.value = '';
        palDisplay.innerText = 'E: --- , N: ---';
        wgsDisplay.innerText = 'Lat: --- , Lon: ---';
        display.innerText = 'انقر على الخريطة لتحديد موقع ومشاركته.';
    });

    // فحص الرابط عند تشغيل الصفحة
    function checkUrl() {
        const params = new URLSearchParams(window.location.search);
        const x = parseFloat(params.get('x'));
        const y = parseFloat(params.get('y'));
        const z = parseFloat(params.get('z'));

        if (!isNaN(x) && !isNaN(y)) {
            initLayer();
            const view = map.getView();
            view.setCenter([x, y]);
            if (!isNaN(z)) view.setZoom(z);

            const feature = new ol.Feature({ geometry: new ol.geom.Point([x, y]) });
            shareLayer.getSource().addFeature(feature);
            
            // تحديث العرض النصي أيضاً عند التحميل من الرابط
            palDisplay.innerText = `E: ${x.toFixed(3)} , N: ${y.toFixed(3)}`;
            const lonLat = ol.proj.transform([x, y], 'EPSG:28191', 'EPSG:4326');
            wgsDisplay.innerText = `Lat: ${lonLat[1].toFixed(6)} , Lon: ${lonLat[0].toFixed(6)}`;
        }
    }

    checkUrl();
}