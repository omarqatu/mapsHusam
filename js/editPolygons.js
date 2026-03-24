// js/editPolygons.js

/**
 * دالة تهيئة أدوات تحرير المضلعات
 */
function initializePolygonEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select;
    let selectedLayerName = null; // اسم المتغير الخاص بالطبقة في التطبيق
    let selectedLayerSource = null;
    let currentFeature = null;
    let currentTransactionType = null;

    // عناصر الواجهة (DOM)
    const editSelect = document.getElementById('edit-layer-select');
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    // الإعدادات
    const proxyUrl = '/proxy/geoserver/wfs'; 
    const featureNS = 'http://localhost:8080/geoserver/realestate'; 
    const workspaceName = 'realestate'; 

    // خريطة لربط اسم المتغير في التطبيق باسم الطبقة الفعلي في GeoServer
    const layerNameMap = {
        'landLayer': 'LandSale'
        // أضف هنا باقي الطبقات إذا لزم الأمر: 'اسم_المتغير': 'اسم_الطبقة_في_جيوسيرفر'
    };

    editSelect.onchange = () => {
        selectedLayerName = editSelect.value;
        if (selectedLayerName && overlayLayersObj[selectedLayerName]) {
            selectedLayerSource = overlayLayersObj[selectedLayerName].getSource();
        } else {
            selectedLayerSource = null;
        }
        deactivatePolygonEditTools();
    };

    function checkLayerSelected() {
        if (!selectedLayerSource) {
            alert('⚠️ يرجى اختيار طبقة مضلعات من القائمة أولاً');
            return false;
        }
        return true;
    }

    // ================= التحكم بالتفاعلات (Interactions) =================
    function disableAllEditInteractions() {
        if (draw) { map.removeInteraction(draw); draw = null; }
        if (modify) { map.removeInteraction(modify); modify = null; }
        if (snap) { map.removeInteraction(snap); snap = null; }
        if (select) { map.removeInteraction(select); select = null; }
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active'));
    }

    function deactivatePolygonEditTools() {
        disableAllEditInteractions();
        if (attributeModal) attributeModal.style.display = 'none';
        currentFeature = null;
    }
    window.deactivatePolygonEditTools = deactivatePolygonEditTools;

    function setupInteractions(mode) {
        if (!checkLayerSelected()) return;
        disableAllEditInteractions();

        if (mode === 'add') {
            draw = new ol.interaction.Draw({
                source: selectedLayerSource,
                type: 'Polygon',
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: '#2196F3', width: 3 }),
                    fill: new ol.style.Fill({ color: 'rgba(33, 150, 243, 0.2)' })
                })
            });

            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                disableAllEditInteractions();
                showAttributeModal(false);
            });
            map.addInteraction(draw);
            addFeatureBtn.classList.add('active');

        } else if (mode === 'modify') {
            select = new ol.interaction.Select({ layers: [overlayLayersObj[selectedLayerName]] });
            map.addInteraction(select);
            modify = new ol.interaction.Modify({ features: select.getFeatures() });
            map.addInteraction(modify);
            
            modify.on('modifyend', (e) => {
                currentFeature = e.features.item(0);
                currentTransactionType = 'update';
                showAttributeModal(true);
            });
            modifyFeatureBtn.classList.add('active');

        } else if (mode === 'delete') {
            select = new ol.interaction.Select({ layers: [overlayLayersObj[selectedLayerName]] });
            map.addInteraction(select);
            select.on('select', (e) => {
                const feature = e.selected[0];
                if (feature && confirm('هل أنت متأكد من حذف هذا المعلم؟')) {
                    sendWFS_T(feature, 'delete');
                }
            });
            deleteFeatureBtn.classList.add('active');
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    // ================= نافذة البيانات (Attributes) =================
    function showAttributeModal(isUpdate) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة مضلع جديد' : 'تعديل البيانات';
        attributeForm.innerHTML = '';

        // الحقول التي يدخلها المستخدم
        const fields = [
            { name: 'price', label: 'السعر', type: 'number' },
            { name: 'des', label: 'الوصف', type: 'text' },
            { name: 'pic', label: 'رابط الصورة', type: 'url' },
            { name: 'video', label: 'رابط الفيديو', type: 'url' },
            { name: 'area', label: 'المساحة (م²)', type: 'number' }
        ];

        fields.forEach(field => {
            const div = document.createElement('div');
            div.style.marginBottom = '10px';
            div.innerHTML = `
                <label style="display:block; font-weight:bold; margin-bottom:5px;">${field.label}</label>
                <input type="${field.type}" name="${field.name}" 
                       value="${isUpdate ? currentFeature.get(field.name) || '' : ''}"
                       style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">
            `;
            attributeForm.appendChild(div);
        });

        attributeModal.style.display = 'block';
    }

    // ================= جلب بيانات الموقع تلقائياً =================
    async function getAutoFields(geometry) {
        try {
            const extent = geometry.getExtent();
            const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
            const wktPoint = `POINT(${center[0]} ${center[1]})`;
            
            // استعلام WFS لجلب الموقع من طبقة realestate:Location
            const url = `${proxyUrl}?service=WFS&version=1.1.0&request=GetFeature&typeName=realestate:Location&outputFormat=application/json&CQL_FILTER=INTERSECTS(geom,${wktPoint})`;
            
            const resp = await fetch(url);
            const data = await resp.json();
            
            if (data.features && data.features.length > 0) {
                const props = data.features[0].properties;
                return {
                    location: props.location || '',
                    gov_a: props.gov_a || '',
                    village_a: props.village_a || ''
                };
            }
        } catch (e) {
            console.error('Error fetching location data:', e);
        }
        return { location: '', gov_a: '', village_a: '' };
    }

    // ================= تنفيذ العمليات (WFS-T) =================
    async function submitAttributes() {
        const formData = new FormData(attributeForm);
        const props = {};
        formData.forEach((val, key) => props[key] = val);
        
        submitAttributesBtn.disabled = true;
        submitAttributesBtn.textContent = '⏳ جاري الحفظ...';

        try {
            if (currentTransactionType === 'insert') {
                // جلب القيم التلقائية (location, gov_a, village_a)
                const autoFields = await getAutoFields(currentFeature.getGeometry());
                Object.assign(props, autoFields);
                props.status = 0; // القيمة الافتراضيةstatus
            }

            currentFeature.setProperties(props);
            await sendWFS_T(currentFeature, currentTransactionType);
            attributeModal.style.display = 'none';
        } catch (e) {
            alert('خطأ أثناء الحفظ: ' + e.message);
        } finally {
            submitAttributesBtn.disabled = false;
            submitAttributesBtn.textContent = 'حفظ';
        }
    }

    function sendWFS_T(feature, type) {
        const format = new ol.format.WFS();
        
        // استخدام اسم الطبقة الصحيح من الخريطة
        const geoserverLayerName = layerNameMap[selectedLayerName] || selectedLayerName;
        
        const gml = new ol.format.GML({
            featureNS: featureNS,
            featureType: geoserverLayerName, // اسم الطبقة في GeoServer
            srsName: 'EPSG:28191'
        });
        
        const fCloned = feature.clone();
        fCloned.setId(feature.getId());

        let node;
        if (type === 'insert') node = format.writeTransaction([fCloned], null, null, gml);
        else if (type === 'update') node = format.writeTransaction(null, [fCloned], null, gml);
        else if (type === 'delete') node = format.writeTransaction(null, null, [fCloned], gml);

        const payload = new XMLSerializer().serializeToString(node);
        
        // --- طباعة البيانات المرسلة للـ Console لفحصها ---
        console.log("WFS-T Payload to GeoServer:", payload);
        // -------------------------------------------------

        return fetch(proxyUrl, {
            method: 'POST',
            body: payload
        })
        .then(res => res.text())
        .then(text => {
            if (text.includes('Exception')) {
                alert('خطأ من السيرفر (GeoServer). راجع الـ Console.');
                console.error("GeoServer Response Error:", text);
            } else {
                alert('✅ تم تنفيذ العملية بنجاح');
                selectedLayerSource.refresh();
                deactivatePolygonEditTools();
            }
        });
    }

    // ================= ربط الأحداث (Event Listeners) =================
    addFeatureBtn.onclick = () => setupInteractions('add');
    modifyFeatureBtn.onclick = () => setupInteractions('modify');
    deleteFeatureBtn.onclick = () => setupInteractions('delete');
    
    submitAttributesBtn.onclick = submitAttributes;
    cancelAttributesBtn.onclick = () => {
        if (currentTransactionType === 'insert') selectedLayerSource.removeFeature(currentFeature);
        deactivatePolygonEditTools();
    };
}

window.initializePolygonEditTools = initializePolygonEditTools;