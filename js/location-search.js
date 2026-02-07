// js/location-search.js

function initializeLocationSearch(map, overlayLayersObj) {
    const getMyLocationBtn = document.getElementById('get-my-location-btn');
    const selectFromMapBtn = document.getElementById('select-from-map-btn');
    const selectedLocationDisplay = document.getElementById('selected-location-display');
    const searchLayerSelect = document.getElementById('search-layer-select');
    const searchRadiusInput = document.getElementById('search-radius-input');
    const executeLocationSearchBtn = document.getElementById('execute-location-search-btn');
    const resultsPanel = document.getElementById('results-panel');

    let searchCenterLocation = null;
    let mapClickListenerKey = null;

    const searchMarkerSource = overlayLayersObj.searchMarkerLayer?.getSource();
    const searchResultsHighlightSource = overlayLayersObj.searchResultsHighlightLayer?.getSource();

    function getDistanceInMeters(coord1, coord2) {
        const dx = coord1[0] - coord2[0];
        const dy = coord1[1] - coord2[1];
        return Math.sqrt(dx * dx + dy * dy);
    }

    // جعل هذه الدالة متاحة عالمياً ليتم استدعاؤها عند فتح اللوحة من main.js
    window.populateSearchLayerSelect = function() {
        if (!searchLayerSelect) return;
        searchLayerSelect.innerHTML = '<option value="">-- اختر الخدمة أو العقار --</option>';
        
        const excluded = ['المدن', 'المحافظات', 'الطرق', 'city', 'gov', 'road'];
        Object.keys(overlayLayersObj).forEach(key => {
            const lyr = overlayLayersObj[key];
            const title = lyr.get('title') || '';
            const isExcluded = excluded.some(word => title.includes(word));
            
            if (title && !key.toLowerCase().includes('search') && !isExcluded) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = title;
                searchLayerSelect.appendChild(option);
            }
        });
    };

    getMyLocationBtn?.addEventListener('click', () => {
        if (!navigator.geolocation) return alert("المتصفح لا يدعم تحديد الموقع.");
        selectedLocationDisplay.textContent = 'جاري تحديد موقعك...';
        navigator.geolocation.getCurrentPosition((pos) => {
            const coords = ol.proj.fromLonLat([pos.coords.longitude, pos.coords.latitude], 'EPSG:28191');
            searchCenterLocation = coords;
            searchMarkerSource?.clear();
            searchMarkerSource?.addFeature(new ol.Feature(new ol.geom.Point(coords)));
            map.getView().animate({ center: coords, zoom: 18, duration: 1000 });
            selectedLocationDisplay.textContent = `تم تحديد موقعك بنجاح`;
            selectedLocationDisplay.style.color = "#28a745";
        }, () => {
            alert("فشل الوصول للموقع. تأكد من تفعيل GPS.");
            selectedLocationDisplay.textContent = 'فشل تحديد الموقع.';
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

    executeLocationSearchBtn?.addEventListener('click', () => {
        if (!searchCenterLocation) return alert("الرجاء تحديد موقع البحث أولاً.");
        const selectedLayerKey = searchLayerSelect.value;
        if (!selectedLayerKey) return alert("الرجاء اختيار نوع العقار أو الخدمة.");

        const radius = parseFloat(searchRadiusInput.value);
        const source = overlayLayersObj[selectedLayerKey].getSource();
        const features = source.getFeatures();
        let nearby = [];

        if (isNaN(radius) || radius <= 0) {
            let minDistance = Infinity;
            let closestFeature = null;
            features.forEach(f => {
                const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                if (dist < minDistance) {
                    minDistance = dist;
                    closestFeature = f;
                }
            });
            if (closestFeature) nearby = [closestFeature];
        } else {
            nearby = features.filter(f => {
                const dist = getDistanceInMeters(searchCenterLocation, f.getGeometry().getClosestPoint(searchCenterLocation));
                return dist <= radius;
            });
        }

        searchResultsHighlightSource?.clear();
        if (nearby.length > 0) {
            searchResultsHighlightSource?.addFeatures(nearby);
            displayResults(nearby, selectedLayerKey);
        } else {
            alert("لا توجد نتائج ضمن هذه المسافة.");
            resultsPanel?.classList.add('hidden');
        }
    });

    function displayResults(features, layerKey) {
        const tbody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span');
        if (!tbody) return;
        tbody.innerHTML = '';
        resultsPanel?.classList.remove('hidden');
        if (countSpan) countSpan.textContent = features.length;

        const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);

        features.forEach((f, i) => {
            const props = f.getProperties();
            const row = document.createElement('tr');
            row.innerHTML = `
                <td style="width:30px; vertical-align:top; text-align:center; padding-top:10px; font-weight:bold; color:#666;">${i + 1}</td>
                <td>${window.formatFeatureInfo ? window.formatFeatureInfo(props, isRealEstate) : 'تفاصيل المعلم'}</td>
            `;
            row.onclick = (e) => {
                if (e.target.tagName !== 'A' && e.target.tagName !== 'BUTTON') {
                    map.getView().fit(f.getGeometry().getExtent(), { duration: 800, maxZoom: 19 });
                }
            };
            tbody.appendChild(row);
        });

        if (features.length > 0) {
            const extent = ol.extent.createEmpty();
            features.forEach(f => ol.extent.extend(extent, f.getGeometry().getExtent()));
            map.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50], maxZoom: 17 });
        }
    }
}