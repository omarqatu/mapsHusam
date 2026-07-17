// js/location-search.js

function initializeLocationSearch(map, overlayLayersObj) {
    const getMyLocationBtn = document.getElementById('get-my-location-btn');
    const selectFromMapBtn = document.getElementById('select-from-map-btn');
    const selectedLocationDisplay = document.getElementById('selected-location-display');
    const searchLayerSelect = document.getElementById('search-layer-select');
    const searchRadiusInput = document.getElementById('search-radius-input');
    const executeLocationSearchBtn = document.getElementById('execute-location-search-btn');
    const clearLocationSearchBtn = document.getElementById('clear-location-search-btn');
    const resultsPanel = document.getElementById('results-panel');
    
    const printResultsBtn = document.getElementById('print-location-results');

    let searchCenterLocation = null;
    let mapClickListenerKey = null;

    const searchMarkerSource = overlayLayersObj.searchMarkerLayer?.getSource();
    const searchResultsHighlightSource = overlayLayersObj.searchResultsHighlightLayer?.getSource();

    function getDistanceInMeters(coord1, coord2) {
        const dx = coord1[0] - coord2[0];
        const dy = coord1[1] - coord2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    window.populateSearchLayerSelect = function() {
        if (!searchLayerSelect) return;
        searchLayerSelect.innerHTML = '<option value="">-- اختر الخدمة أو العقار --</option>';
        const excluded = ['المدن', 'المحافظات', 'الطرق', 'المناطق', 'city', 'gov', 'road', 'locationLayer'];
        const globalExcludedKeys = MAP_CONFIG.globalExclusions || [];

        Object.keys(overlayLayersObj).forEach(key => {
            const lyr = overlayLayersObj[key];
            const title = lyr.get('title') || '';
            const isExcluded = excluded.some(word => title.includes(word)) || globalExcludedKeys.includes(key.replace('Layer', ''));

            if (title && !key.toLowerCase().includes('search') && !isExcluded) { // تم دمج شرط الاستثناءات
                const option = document.createElement('option');
                option.value = key;
                option.textContent = title;
                searchLayerSelect.appendChild(option);
            }
        });
    };

    getMyLocationBtn?.addEventListener('click', () => {
        selectedLocationDisplay.textContent = 'جاري تحديد موقعك...';
        selectedLocationDisplay.style.color = '#007bff';

        window.requestGeolocationPosition((pos) => {
            const coords = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude], 'EPSG:28191');
            searchCenterLocation = coords;
            searchMarkerSource?.clear();
            searchMarkerSource?.addFeature(new ol.Feature(new ol.geom.Point(coords)));
            map.getView().animate({ center: coords, zoom: 18, duration: 1000 });
            selectedLocationDisplay.textContent = 'تم تحديد موقعك بنجاح';
            selectedLocationDisplay.style.color = '#28a745';
        }, (error) => {
            console.error('GPS search failed:', error);
            alert(error.message || 'فشل الوصول للموقع. تأكد من تفعيل GPS.');
            selectedLocationDisplay.textContent = 'فشل تحديد الموقع.';
            selectedLocationDisplay.style.color = '#dc3545';
        });
    });

    selectFromMapBtn?.addEventListener('click', () => {
        selectedLocationDisplay.textContent = 'انقر على الخريطة لتحديد النقطة...';
        selectedLocationDisplay.style.color = "#007bff";
        if (mapClickListenerKey) ol.Observable.unByKey(mapClickListenerKey);
        mapClickListenerKey = map.once('click', (evt) => {
            searchCenterLocation = evt.coordinate;
            searchMarkerSource?.clear();
            searchMarkerSource?.addFeature(new ol.Feature(new ol.geom.Point(searchCenterLocation)));
            selectedLocationDisplay.textContent = 'تم تحديد النقطة من الخريطة.';
        });
    });

    clearLocationSearchBtn?.addEventListener('click', () => {
        searchCenterLocation = null;
        searchMarkerSource?.clear();
        searchResultsHighlightSource?.clear();
        selectedLocationDisplay.textContent = 'لم يتم تحديد موقع بعد';
        selectedLocationDisplay.style.color = "gray";
        searchRadiusInput.value = "500";
        searchLayerSelect.value = "";
        resultsPanel?.classList.add('hidden');
        if (mapClickListenerKey) ol.Observable.unByKey(mapClickListenerKey);
        
        // إغلاق البوب أب عند المسح
        map.getOverlays().forEach(ov => {
            if (ov.getElement() && (ov.getElement().id === 'popup' || ov.getElement().classList.contains('ol-popup'))) {
                ov.setPosition(undefined);
            }
        });
    });

    executeLocationSearchBtn?.addEventListener('click', async () => {
        if (!searchCenterLocation) return alert("الرجاء تحديد موقع البحث أولاً.");
        const selectedLayerKey = searchLayerSelect.value;
        if (!selectedLayerKey) return alert("الرجاء اختيار نوع العقار أو الخدمة.");

        // تسجيل حدث البحث المكاني
        if (window.logMapEvent) {
            const layerTitle = overlayLayersObj[selectedLayerKey]?.get('title') || selectedLayerKey;
            window.logMapEvent('location_search', null, layerTitle);
        }

        const radiusStr = searchRadiusInput.value.trim();

        // تحديد workspace و layer name
        const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(selectedLayerKey);
        const workspace = isRealEstate ? 'realestate' : 'services';
        const layerNameMap = { 'rentLayer': 'ApartRent', 'saleLayer': 'ApartSale', 'landLayer': 'LandSale' };
        const layerName = layerNameMap[selectedLayerKey] || selectedLayerKey.replace('Layer', '');

        // استخدام البحث من السيرفر بدون BBOX للحصول على جميع النتائج
        try {
            const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
            const params = new URLSearchParams({
                layer: layerName,
                workspace: workspace
            });

            const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                alert("لا توجد نتائج.");
                resultsPanel?.classList.add('hidden');
                return;
            }

            // تحويل GeoJSON إلى OpenLayers Features
            const format = new ol.format.GeoJSON();
            const features = data.features.map(f => format.readFeature(f));

            // فلترة حسب المسافة
            let nearby = [];
            searchResultsHighlightSource?.clear();

            const radius = parseFloat(radiusStr) || 0;
            if (radius > 0) {
                const circleFeature = new ol.Feature(new ol.geom.Circle(searchCenterLocation, radius));
                circleFeature.setStyle(new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: 'rgba(0, 123, 255, 0.5)', width: 2, lineDash: [5, 5] }),
                    fill: new ol.style.Fill({ color: 'rgba(0, 123, 255, 0.1)' })
                }));
                searchResultsHighlightSource?.addFeature(circleFeature);
            }

            if (radiusStr === "") {
                let minDistance = Infinity;
                let closestFeature = null;
                features.forEach(f => {
                    const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                    if (dist < minDistance) { minDistance = dist; closestFeature = f; }
                });
                if (closestFeature) nearby = [closestFeature];
            } else {
                if (radius === 0) {
                    nearby = features.filter(f => f.getGeometry().intersectsCoordinate(searchCenterLocation));
                } else {
                    nearby = features.filter(f => {
                        const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                        return dist <= radius;
                    });
                }
            }

            if (nearby.length > 0) {
                searchResultsHighlightSource?.addFeatures(nearby);
                displayResults(nearby, overlayLayersObj[selectedLayerKey]);
            } else {
                alert("لا توجد نتائج تطابق معايير البحث.");
                resultsPanel?.classList.add('hidden');
            }
        } catch (error) {
            console.error("خطأ في البحث المكاني:", error);
            alert("حدث خطأ أثناء البحث. سيتم استخدام البحث المحلي.");

            // Fallback للبحث المحلي
            const layer = overlayLayersObj[selectedLayerKey];
            const source = layer.getSource();
            const features = source.getFeatures();
            let nearby = [];

            searchResultsHighlightSource?.clear();

            const radius = parseFloat(radiusStr) || 0;
            if (radius > 0) {
                const circleFeature = new ol.Feature(new ol.geom.Circle(searchCenterLocation, radius));
                circleFeature.setStyle(new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: 'rgba(0, 123, 255, 0.5)', width: 2, lineDash: [5, 5] }),
                    fill: new ol.style.Fill({ color: 'rgba(0, 123, 255, 0.1)' })
                }));
                searchResultsHighlightSource?.addFeature(circleFeature);
            }

            if (radiusStr === "") {
                let minDistance = Infinity;
                let closestFeature = null;
                features.forEach(f => {
                    const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                    if (dist < minDistance) { minDistance = dist; closestFeature = f; }
                });
                if (closestFeature) nearby = [closestFeature];
            } else {
                if (radius === 0) {
                    nearby = features.filter(f => f.getGeometry().intersectsCoordinate(searchCenterLocation));
                } else {
                    nearby = features.filter(f => {
                        const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                        return dist <= radius;
                    });
                }
            }

            if (nearby.length > 0) {
                searchResultsHighlightSource?.addFeatures(nearby);
                displayResults(nearby, layer);
            } else {
                alert("لا توجد نتائج تطابق معايير البحث.");
                resultsPanel?.classList.add('hidden');
            }
        }
    });

    function displayResults(features, layer) {
        const tbody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span');
        if (!tbody) return;

        features.sort((a, b) => {
            const rA = parseFloat(a.get('rating')) || 0;
            const rB = parseFloat(b.get('rating')) || 0;
            return rB - rA;
        });

        tbody.innerHTML = '';
        resultsPanel?.classList.remove('hidden');
        if (countSpan) countSpan.textContent = features.length;

        features.forEach((f, i) => {
            const row = document.createElement('tr');
            const detailsHtml = window.generateFeatureHtml ? window.generateFeatureHtml(f, layer) : 'تفاصيل المعلم';

            row.innerHTML = `
                <td style="width:30px; vertical-align:top; text-align:center; padding-top:10px; font-weight:bold; color:#666;">${i + 1}</td>
                <td class="result-cell-content">${detailsHtml}</td>
            `;
            
            row.style.cursor = "pointer";
            row.onclick = (e) => {
                if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
                    const geometry = f.getGeometry();
                    const extent = geometry.getExtent();
                    const coord = geometry.getType() === 'Point' ? geometry.getCoordinates() : ol.extent.getCenter(extent);

                    // 1. عمل الزووم (التكبير)
                    map.getView().animate({ center: coord, zoom: 19, duration: 800 });

                    // 2. إظهار البوب أب (نفس منطق البحث السريع)
                    window.currentPopupCoordinate = coord;

                    if (window.generateFeatureHtml) {
                        const contentElement = document.getElementById('popup-content');
                        if (contentElement) {
                            contentElement.innerHTML = detailsHtml;
                        }
                        
                        // البحث عن الـ Overlay الخاص بالبوب أب وتحريكه للموقع
                        map.getOverlays().forEach(ov => {
                            const el = ov.getElement();
                            if (el && (el.id === 'popup' || el.classList.contains('ol-popup'))) {
                                ov.setPosition(coord);
                            }
                        });
                    }
                }
            };
            tbody.appendChild(row);
        });

        const combinedExtent = searchResultsHighlightSource.getExtent();
        if (searchCenterLocation) ol.extent.extend(combinedExtent, ol.extent.boundingExtent([searchCenterLocation]));
        map.getView().fit(combinedExtent, { duration: 1200, padding: [80, 80, 80, 80], maxZoom: 18 });
    }

    printResultsBtn?.addEventListener('click', () => {
        const content = document.getElementById('results-table').outerHTML;
        const newWin = window.open('', '_blank');
        newWin.document.write(`
            <html>
                <head>
                    <title>طباعة نتائج البحث المكاني</title>
                    <style>
                        body { font-family: Arial, sans-serif; direction: rtl; padding: 20px; }
                        table { width: 100%; border-collapse: collapse; }
                        th, td { border: 1px solid #ddd; padding: 10px; text-align: right; }
                        .popup-img-container, .popup-link, button { display: none; }
                        .popup-body { max-height: none !important; overflow: visible !important; }
                    </style>
                </head>
                <body>
                    <h2>نتائج البحث المكاني - ${new Date().toLocaleDateString('ar-EG')}</h2>
                    ${content}
                </body>
            </html>
        `);
        newWin.document.close();
        newWin.print();
    });
    
    window.populateSearchLayerSelect();
}
