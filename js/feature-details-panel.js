// js/feature-details-panel.js

/**
 * تهيئة منطق لوحة التفاصيل الجانبية (Details Panel)
 * هذه اللوحة تفتح عند النقر على الخريطة لعرض تفاصيل المعالم الموجودة في نقطة النقر.
 *
 * @param {ol.Map} map - كائن خريطة OpenLayers.
 * @param {function} togglePanelVisibility - دالة من main.js لتبديل رؤية اللوحات.
 */
function initializeFeatureDetailsPanel(map, togglePanelVisibility) {
    const detailsPanel = document.getElementById('detailsPanel');
    const selectedFeatureDetails = document.getElementById('selectedFeatureDetails');
    const featuresListContainer = document.getElementById('featuresListInExtent');

    if (!detailsPanel || !selectedFeatureDetails || !featuresListContainer) {
        console.error("عناصر لوحة التفاصيل (detailsPanel, selectedFeatureDetails, featuresListInExtent) غير موجودة في DOM.");
        return;
    }

    const ignoredLayerKeys = [
        'searchMarkerLayer',
        'searchResultsHighlightLayer',
        'locationLayer',
        // طبقات لا نريد استعلامها
    ];

    // ==========================================================
    // وظائف عرض تفاصيل المعالم
    // ==========================================================

    /**
     * تعرض خصائص معلم واحد في الجزء العلوي من اللوحة.
     * @param {ol.Feature} feature - المعلم المراد عرضه.
     */
    function displaySelectedFeatureDetails(feature) {
        if (!feature) {
            selectedFeatureDetails.innerHTML = '<p>انقر على معلم في الخريطة أو اختر من القائمة أدناه لعرض تفاصيله هنا.</p>';
            return;
        }

        // ⭐ إزالة التمييز السابق من الخريطة عند عرض تفاصيل جديدة ⭐
        if (window.overlayLayersObj && window.overlayLayersObj.searchResultsHighlightLayer) {
            window.overlayLayersObj.searchResultsHighlightLayer.getSource().clear();
        }
        
        const properties = feature.getProperties();
        const sourceLayer = feature.get('sourceLayer') || 'بيانات عامة'; 
        const featureId = feature.getId() || 'معرّف غير متوفر';
        
        let htmlContent = `<h4 style="border-bottom: 1px solid #ccc; padding-bottom: 5px;">${sourceLayer} - ID: ${featureId}</h4>`;
        
        htmlContent += `<div class="feature-properties-scroll">`;
        for (const key in properties) {
            // استبعاد الخصائص الداخلية لـ OpenLayers والـ geometry
            if (key !== 'geometry' && key !== 'sourceLayer' && !key.startsWith('_') && properties[key] !== undefined) {
                let value = properties[key];
                if (typeof value === 'number' && value > 1000) {
                    value = value.toLocaleString();
                }
                htmlContent += `<p><strong>${key}:</strong> ${value || 'قيمة فارغة'}</p>`;
            }
        }
        htmlContent += `</div>`;
        selectedFeatureDetails.innerHTML = htmlContent;
        
        // ⭐ تمييز المعلم على الخريطة عند عرض تفاصيله ⭐
        if (window.overlayLayersObj && window.overlayLayersObj.searchResultsHighlightLayer) {
            const highlightSource = window.overlayLayersObj.searchResultsHighlightLayer.getSource();
            // يجب استنساخ المعلم قبل إضافته لمنع التداخل مع مصدر بيانات الطبقة الأصلية
            highlightSource.addFeature(feature.clone());
        }
    }

    // ==========================================================
    // وظيفة تحديث قائمة المعالم في المدى
    // ==========================================================
    
    /**
     * تستخرج وتحدث قائمة المعالم المرئية حالياً في مدى الخريطة.
     */
    function updateFeaturesListInExtent() {
        if (!window.overlayLayersObj) return;

        const extent = map.getView().calculateExtent(map.getSize());
        const allFeaturesInExtent = [];
        
        // 1. جمع المعالم من جميع طبقات التراكب
        for (const key in window.overlayLayersObj) {
            const layer = window.overlayLayersObj[key];
            if (layer && layer.getVisible() && !ignoredLayerKeys.includes(key)) {
                const source = layer.getSource();
                if (source && typeof source.getFeaturesInExtent === 'function') {
                    const features = source.getFeaturesInExtent(extent);
                    features.forEach(feature => {
                        feature.set('sourceLayer', key);
                        allFeaturesInExtent.push(feature);
                    });
                }
            }
        }

        // 2. بناء محتوى القائمة
        let htmlContent = '<h6>المعالم القريبة في المدى الحالي (انقر لعرض التفاصيل):</h6>';
        if (allFeaturesInExtent.length === 0) {
            htmlContent += '<p style="color: #999;">لا توجد معالم بيانات في المدى المرئي حالياً.</p>';
        } else {
            allFeaturesInExtent.forEach((feature, index) => {
                const layerName = feature.get('sourceLayer');
                const featureId = feature.getId() || `معلم-${index}-${Math.floor(Math.random() * 1000)}`; 
                
                // تخزين المعلم مؤقتاً لتسهيل الوصول إليه عند النقر (باستخدام ID فريد)
                const uniqueId = `extent-feature-${featureId}-${layerName}-${index}`;
                window[uniqueId] = feature; 

                htmlContent += `<div class="feature-list-item" data-feature-id="${uniqueId}" style="cursor: pointer; padding: 5px; border-bottom: 1px dashed #eee;">`;
                htmlContent += ` 	<i class="fas fa-dot-circle" style="color: #007bff;"></i> <strong>${layerName}</strong>: ID ${featureId.toString().substring(0, 15)}...`;
                htmlContent += `</div>`;
            });
        }
        
        featuresListContainer.innerHTML = htmlContent;
        
        // 3. إضافة معالجات النقر على عناصر القائمة
        featuresListContainer.querySelectorAll('.feature-list-item').forEach(item => {
            item.addEventListener('click', (event) => {
                // إزالة صنف 'active' من كل العناصر أولاً
                featuresListContainer.querySelectorAll('.feature-list-item').forEach(el => el.classList.remove('active'));
                // إضافة صنف 'active' للعنصر الذي تم النقر عليه
                event.currentTarget.classList.add('active'); 

                const id = event.currentTarget.dataset.featureId;
                const feature = window[id]; 
                if (feature) {
                    displaySelectedFeatureDetails(feature);

                    // ⭐ تمييز المعلم على الخريطة عند النقر من القائمة ⭐
                    // منطق التمييز تم نقله إلى displaySelectedFeatureDetails لتوحيد العملية.

                    const geometry = feature.getGeometry();
                    if (geometry) {
                        const extent = geometry.getExtent();
                        // تم تعديل الـ padding لأخذ اللوحة الجانبية بعين الاعتبار
                        map.getView().fit(extent, { 
                            duration: 1000, 
                            padding: [100, 100, 100, 450],
                            // ✨ التعديل هنا: تحديد أقصى مستوى تكبير للتحكم في الزووم
                            maxZoom: 18 
                        }); 
                    }
                }
            });
        });
    }

    // جعل الدالة متاحة عالمياً ليتم استدعاؤها من main.js عند فتح اللوحة
    window.updateFeaturesListInExtent = updateFeaturesListInExtent;

    // ==========================================================
    // معالج حدث النقر على الخريطة (للتحديد الفردي)
    // ==========================================================

    map.on('click', function (event) {
        let shouldOpenPanel = detailsPanel.classList.contains('hidden');

        if (typeof window.hideFeaturePopup === 'function') {
            window.hideFeaturePopup();
        }

        const features = [];
        
        // البحث عن معالم في نقطة النقر
        map.forEachFeatureAtPixel(event.pixel, function (feature, layer) {
            if (!feature) return;
            
            let layerKey = null;
            if (window.overlayLayersObj) {
                for (const key in window.overlayLayersObj) {
                    if (window.overlayLayersObj[key] === layer) {
                        layerKey = key;
                        break;
                    }
                }
            }

            if (layerKey && ignoredLayerKeys.includes(layerKey)) {
                return;
            }

            feature.set('sourceLayer', layerKey || 'طبقة بيانات');
            features.push(feature);
        }, {
            hitTolerance: 5,
        });

        if (features.length > 0) {
            // 1. نفتح اللوحة إذا كانت مغلقة، ونحدث قائمة المعالم (القائمة السفلية)
            if (shouldOpenPanel) {
                togglePanelVisibility('detailsPanel', null, updateFeaturesListInExtent);
            } else {
                updateFeaturesListInExtent(); 
            }
            
            // 2. نعرض تفاصيل المعلم الأول في الجزء العلوي (سيؤدي هذا إلى تمييزه)
            displaySelectedFeatureDetails(features[0]);
            
            // 3. إضافة زووم عند النقر مباشرة على الخريطة أيضًا (للنقاط فقط)
            const geometry = features[0].getGeometry();
            if (geometry && geometry.getType() === 'Point') {
                 map.getView().animate({
                    center: geometry.getCoordinates(),
                    zoom: 20, // ✨ التعديل هنا: تحديد مستوى زووم مناسب للنقطة عند النقر
                    duration: 1000
                });
            } else if (geometry) {
                 const extent = geometry.getExtent();
                 map.getView().fit(extent, { 
                    duration: 1000, 
                    padding: [100, 100, 100, 450]
                });
            }
            
        } else {
            // إذا لم يتم العثور على شيء، نمسح التفاصيل والتمييز
            displaySelectedFeatureDetails(null);
            if (!detailsPanel.classList.contains('hidden') && shouldOpenPanel) {
                // نغلق اللوحة إذا لم يتم العثور على أي شيء وفُتحت بواسطة النقر
                // (قد تحتاج إلى تعديل هذا المنطق اعتماداً على سلوكك المطلوب)
                // togglePanelVisibility('detailsPanel', false); // خيار للإغلاق
            }
        }
    });

    // تهيئة المحتوى عند التحميل
    displaySelectedFeatureDetails(null);
}