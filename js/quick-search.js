/**
 * js/quick-search.js
 */

function initializeQuickSearch(map, overlayLayersObj) {
    const container = document.getElementById('quick-search-container');
    const btnLeft = document.getElementById('scrollLeft');
    const btnRight = document.getElementById('scrollRight');
    const resultsPanel = document.getElementById('results-panel');

    if (!container) return;

    // --- 1. تفعيل زر إغلاق لوحة النتائج (X) بطريقة مضمونة ---
    const closeQuickResults = () => {
        if (resultsPanel) {
            resultsPanel.classList.add('hidden');
            if (window.searchResultsHighlightLayer) {
                window.searchResultsHighlightLayer.getSource().clear();
            }
        }
    };

    if (resultsPanel) {
        const closeBtn = resultsPanel.querySelector('.close-btn, .fa-times, #close-results-panel');
        if (closeBtn) {
            const targetBtn = closeBtn.tagName === 'I' ? closeBtn.parentElement : closeBtn;
            targetBtn.onclick = (e) => {
                e.preventDefault();
                closeQuickResults();
            };
            targetBtn.style.cursor = 'pointer';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !resultsPanel.classList.contains('hidden')) {
                closeQuickResults();
            }
        });
    }

    // --- 2. تفعيل أزرار التمرير (يمين/يسار) للشريط العلوي ---
    if (btnLeft && btnRight) {
        btnLeft.onclick = () => container.scrollBy({ left: -250, behavior: 'smooth' });
        btnRight.onclick = () => container.scrollBy({ left: 250, behavior: 'smooth' });
    }

    // --- 3. بناء مصفوفة الطبقات ديناميكياً ---
    const dynamicQuickLayers = [];
    const globalExcludedKeys = MAP_CONFIG.globalExclusions || [];

    const iconMap = {
        'rentLayer': 'fa-home', 'saleLayer': 'fa-key', 'landLayer': 'fa-map',
        'electrician': 'fa-bolt', 'ac_technician': 'fa-snowflake', 'plumber': 'fa-faucet',
        'general_maintenance': 'fa-tools', 'painter': 'fa-paint-roller', 'carpenter': 'fa-hammer',
        'blacksmith': 'fa-industry', 'builder': 'fa-hard-hat', 'house_cleaner': 'fa-broom',
        'aluminum_tech': 'fa-window-maximize', 'car_mechanic': 'fa-car-wrench', 'car_electrician': 'fa-car-battery',
        'tire_tech': 'fa-circle-notch', 'car_wash': 'fa-shuttle-van', 'motorcycle_repair': 'fa-motorcycle',
        'taxi_driver': 'fa-taxi', 'delivery_services': 'fa-truck-delivery', 'tow_truck': 'fa-truck-pickup',
        'cctv_installer': 'fa-video', 'party_planner': 'fa-calendar-star', 'zaffa_bands': 'fa-music',
        'music_bands': 'fa-guitar', 'photographer': 'fa-camera', 'party_rental': 'fa-chair',
        'home_nurse': 'fa-user-nurse', 'masseur': 'fa-hands-holding', 'cupping_specialist': 'fa-kit-medical',
        'nutritionist': 'fa-apple-whole', 'truck_driver': 'fa-truck', 'security_firms': 'fa-shield-halved',
        'furniture_buyer': 'fa-couch', 'gardener': 'fa-leaf', 'pet_care': 'fa-dog',
        'clown_entertainer': 'fa-face-smile-beam', 'online_stores': 'fa-shopping-basket', 'villas_rent': 'fa-vihara',
        'martial_arts_gymnastics': 'fa-user-ninja', 'public_parks_recreation': 'fa-tree', 'hotels': 'fa-hotel',
        'free_distribution': 'fa-gift', 'barber_shop': 'fa-cut', 'video_design_ads': 'fa-film',
        'pharmacies_on_call': 'fa-pills', 'taxis_on_call': 'fa-hand-holding-usd', 'emergency_hospitals': 'fa-hospital',
        'clinics': 'fa-stethoscope', 'doctors_on_call': 'fa-user-md', 'ambulances_on_call': 'fa-ambulance',
        'music_training': 'fa-music', 'lawyers': 'fa-gavel', 'land_surveyors': 'fa-ruler-combined',
        'real_estate_valuers': 'fa-calculator', 'private_tutors': 'fa-chalkboard-teacher', 'programmers': 'fa-code',
        'car_delivery_on_call': 'fa-car', 'motorcycle_delivery_on_call': 'fa-motorcycle',
        'bicycle_delivery_on_call': 'fa-bicycle', 'photographers': 'fa-camera-retro',
        'student_research_assist': 'fa-book'
    };

    if (MAP_CONFIG.layers.realestate) {
        MAP_CONFIG.layers.realestate.forEach(l => {
            if (!globalExcludedKeys.includes(l.id)) {
                console.log(`Adding realestate layer to quick search: ${l.id} (${l.title})`);
                dynamicQuickLayers.push({
                    key: l.id,
                    title: l.title,
                    icon: iconMap[l.id] || 'fa-building'
                });
            }
        });
    }

    if (window.serviceTranslations) {
        Object.keys(window.serviceTranslations).forEach(serviceKey => {
            if (!globalExcludedKeys.includes(serviceKey)) {
                const info = window.serviceTranslations[serviceKey];
                dynamicQuickLayers.push({
                    key: serviceKey + 'Layer',
                    title: info.name,
                    icon: iconMap[serviceKey] || 'fa-question-circle'
                });
            }
        });
    }
    
    // --- تعديل: تمرير item.key و item.title هنا لحل المشكلة ---
    dynamicQuickLayers.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'quick-item';
        btn.innerHTML = `<i class="fas ${item.icon}"></i> ${item.title}`;
        btn.onclick = () => executeQuickSearch(item.key, item.title); 
        container.appendChild(btn);
    });

    // --- دالة البحث المحدثة لاستقبال العنوان والتعامل مع الخطأ ---
    async function executeQuickSearch(layerKey, layerTitle) {
        const layer = overlayLayersObj[layerKey];

        if (!layer) {
            console.warn(`الطبقة "${layerKey}" غير محملة.`);
            alert(`الطبقة "${layerTitle}" غير محملة حالياً.`);
            return;
        }

        // تحديد workspace و layer name
        const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
        const workspace = isRealEstate ? 'realestate' : 'services';
        const layerNameMap = { 'rentLayer': 'ApartRent', 'saleLayer': 'ApartSale', 'landLayer': 'LandSale' };
        const layerName = layerNameMap[layerKey] || layerKey.replace('Layer', '');

        console.log(`Quick Search: layerKey=${layerKey}, layerName=${layerName}, workspace=${workspace}`);

        // الحصول على المدى المرئي الحالي (BBOX)
        const extent = map.getView().calculateExtent(map.getSize());
        const bbox = extent.join(',');

        // استخدام البحث من السيرفر مع فلترة مكانية BBOX
        try {
            const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
            const params = new URLSearchParams({
                layer: layerName,
                workspace: workspace,
                bbox: bbox
            });

            const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
            const data = await response.json();

            if (!data.features || data.features.length === 0) {
                alert(`عذراً، لا تتوفر نتائج لـ "${layerTitle}" في المنطقة الحالية.`);
                if (resultsPanel) resultsPanel.classList.add('hidden');
                return;
            }

            // تحويل GeoJSON إلى OpenLayers Features
            const format = new ol.format.GeoJSON();
            const features = data.features.map(f => format.readFeature(f));

            // --- 4. التمييز والزووم الاحترافي ---
            if (window.searchResultsHighlightLayer) {
                window.searchResultsHighlightLayer.getSource().clear();
                window.searchResultsHighlightLayer.getSource().addFeatures(features);

                const combinedExtent = window.searchResultsHighlightLayer.getSource().getExtent();
                map.getView().fit(combinedExtent, {
                    padding: [80, 80, 80, 80],
                    duration: 1000,
                    maxZoom: 19
                });
            }

            displayQuickResults(features, layer);
        } catch (error) {
            console.error("خطأ في البحث السريع:", error);
            alert("حدث خطأ أثناء البحث. سيتم استخدام البحث المحلي.");

            // Fallback للبحث المحلي
            const source = layer.getSource();
            const allFeatures = source.getFeatures();
            const features = allFeatures.filter(f => {
                const geom = f.getGeometry();
                if (!geom) return false;
                const featureExtent = geom.getExtent();
                return ol.extent.intersects(extent, featureExtent);
            });

            if (features.length === 0) {
                alert(`عذراً، لا تتوفر نتائج لـ "${layerTitle}" في المنطقة التي تشاهدها حالياً.`);
                if (resultsPanel) resultsPanel.classList.add('hidden');
                return;
            }

            if (window.searchResultsHighlightLayer) {
                window.searchResultsHighlightLayer.getSource().clear();
                window.searchResultsHighlightLayer.getSource().addFeatures(features);

                const combinedExtent = window.searchResultsHighlightLayer.getSource().getExtent();
                map.getView().fit(combinedExtent, {
                    padding: [80, 80, 80, 80],
                    duration: 1000,
                    maxZoom: 19
                });
            }

            displayQuickResults(features, layer);
        }
    }

    function displayQuickResults(features, layer) {
        const resultsTableBody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span');

        if (!resultsPanel || !resultsTableBody) return;

        // الترتيب حسب الـ rating تنازلياً
        features.sort((a, b) => {
            const ratingA = parseFloat(a.get('rating')) || 0;
            const ratingB = parseFloat(b.get('rating')) || 0;
            return ratingB - ratingA;
        });

        resultsTableBody.innerHTML = '';
        if (countSpan) countSpan.textContent = features.length;

        features.forEach((feat, index) => {
            const tr = document.createElement('tr');
            let featureContent = window.generateFeatureHtml ? window.generateFeatureHtml(feat, layer) : `<div>معلم ${index + 1}</div>`;

            tr.innerHTML = `
                <td style="vertical-align: top; font-weight: bold; color: #888;">${index + 1}</td>
                <td class="result-card-container">
                    <div class="quick-result-card">${featureContent}</div>
                </td>
            `;

            tr.onclick = () => {
                const geometry = feat.getGeometry();
                const coord = geometry.getType() === 'Point' ? geometry.getCoordinates() : ol.extent.getCenter(geometry.getExtent());
                map.getView().animate({ center: coord, zoom: 19, duration: 800 });

                window.currentPopupCoordinate = coord;

                if (window.generateFeatureHtml) {
                    const content = document.getElementById('popup-content');
                    if (content) content.innerHTML = featureContent;
                    map.getOverlays().forEach(ov => {
                        if (ov.getElement() && (ov.getElement().id === 'popup' || ov.getElement().classList.contains('ol-popup'))) {
                            ov.setPosition(coord);
                        }
                    });
                }
            };
            resultsTableBody.appendChild(tr);
        });

        resultsPanel.classList.remove('hidden');
    }
}
