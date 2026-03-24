/**
 * editPolygon.js - تحرير المضلعات والخطوط (أراضي، طرق، حدود إدارية)
 */
function initializePolygonEditTools(map, overlayLayersObj, enableAllDefaultInteractions, disableSpecificInteractions) {
    let draw, modify, snap, select;
    let selectedLayerSource;
    let activeLayerKey = null;
    let currentFeature = null;
    let currentTransactionType = null;

    const layerSelect = document.getElementById('polygon-layer-select'); 
    const addFeatureBtn = document.getElementById('polygon-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('polygon-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('polygon-delete-feature-btn');
    const attributeModal = document.getElementById('polygonAttributeModal');
    const attributeForm = document.getElementById('polygonAttributeForm');
    const submitAttributesBtn = document.getElementById('polygonSubmitAttributes');
    const cancelAttributesBtn = document.getElementById('polygonCancelAttributes');

    // 1. فلترة الطبقات: عرض المضلعات والخطوط فقط واستبعاد النقاط
    function populatePolygonLayers() {
        if (!layerSelect) return;
        layerSelect.innerHTML = '<option value="">--- اختر طبقة (أرض/طريق/منطقة) ---</option>';
        
        Object.keys(overlayLayersObj).forEach(key => {
            const layer = overlayLayersObj[key];
            // استبعاد الطبقات التي نعرف أنها نقطية يقيناً
            const isPointLayer = key.includes('rentLayer') || key.includes('saleLayer') || key.toLowerCase().includes('service');
            
            if (!isPointLayer) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = layer.get('title') || key;
                layerSelect.appendChild(opt);
            }
        });
    }

    // 2. دالة تحديد الـ Workspace والنوع بناءً على الطبقة المختارة
    function getWFSConfig(layerKey) {
        // إذا كانت أراضي تتبع realestate، غير ذلك نعتبرها base_layers أو حسب مشروعك
        const isRealEstate = layerKey === 'landLayer';
        const workspace = isRealEstate ? 'realestate' : 'base_layers';
        
        return {
            ws: workspace,
            uri: `http://localhost:8080/geoserver/${workspace}`,
            type: layerKey.replace('Layer', ''),
            geomName: 'geom',
            // تحديد نوع الرسم: إذا كان الاسم يحتوي على Road أو Street يكون خط، غير ذلك مضلع
            geometryType: layerKey.toLowerCase().includes('road') ? 'LineString' : 'Polygon'
        };
    }

    function disableAllEditInteractions() {
        [draw, modify, snap, select].forEach(i => { if(i) map.removeInteraction(i); });
        draw = modify = snap = select = null;
    }

    function deactivatePolygonEditTools() {
        disableAllEditInteractions();
        if (typeof enableAllDefaultInteractions === 'function') enableAllDefaultInteractions();
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active'));
        if (attributeModal) attributeModal.style.display = 'none';
    }
    window.deactivatePolygonEditTools = deactivatePolygonEditTools;

    // 3. إعداد التفاعلات (الرسم أو الاختيار)
    function setupInteractions(mode) {
        activeLayerKey = layerSelect.value;
        if (!activeLayerKey) return alert('يرجى اختيار الطبقة أولاً من القائمة');

        // تعطيل أدوات النقاط لضمان عدم التداخل
        if (window.deactivatePointEditTools) window.deactivatePointEditTools();
        
        disableAllEditInteractions();
        const layer = overlayLayersObj[activeLayerKey];
        selectedLayerSource = layer.getSource();
        const config = getWFSConfig(activeLayerKey);

        if (mode === 'add') {
            addFeatureBtn.classList.add('active');
            draw = new ol.interaction.Draw({
                source: selectedLayerSource,
                type: config.geometryType // Polygon أو LineString
            });
            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                // تعيين الـ ID مؤقتاً لتمييزه
                currentFeature.setId(config.type + '.' + Math.floor(Math.random() * 1000));
                showAttributeModal(currentFeature);
            });
            map.addInteraction(draw);
        } else {
            mode === 'modify' ? modifyFeatureBtn.classList.add('active') : deleteFeatureBtn.classList.add('active');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);

            select.on('select', (e) => {
                currentFeature = e.target.getFeatures().getArray()[0];
                if (!currentFeature) return;

                if (mode === 'delete') {
                    if (confirm('هل تريد حذف هذا المعلم نهائياً؟')) sendWFS_T(currentFeature, 'delete');
                } else {
                    currentTransactionType = 'update';
                    modify = new ol.interaction.Modify({ features: select.getFeatures() });
                    map.addInteraction(modify);
                    showAttributeModal(currentFeature);
                }
            });
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    // 4. عرض نافذة الخصائص (ديناميكياً)
    async function showAttributeModal(feature) {
        attributeForm.innerHTML = 'جاري تحميل الحقول...';
        attributeModal.style.display = 'block';
        
        const config = getWFSConfig(activeLayerKey);
        // جلب الحقول من الـ DescribeFeatureType لضمان مطابقتها لقاعدة البيانات
        const url = `/proxy/geoserver/wfs?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${config.ws}:${config.type}`;
        
        try {
            const res = await fetch(url);
            const xml = new DOMParser().parseFromString(await res.text(), 'text/xml');
            const elements = xml.getElementsByTagNameNS('*', 'element');
            
            attributeForm.innerHTML = '';
            for (let el of elements) {
                const name = el.getAttribute('name');
                if (!['geom', 'id', 'fid', 'objectid'].includes(name.toLowerCase())) {
                    const div = document.createElement('div');
                    div.style.marginBottom = '8px';
                    div.innerHTML = `
                        <label style="display:block; font-size:12px;">${name}</label>
                        <input type="text" name="${name}" value="${feature.get(name) || ''}" style="width:100%; padding:4px;">
                    `;
                    attributeForm.appendChild(div);
                }
            }
        } catch (err) { attributeForm.innerHTML = 'خطأ في تحميل الحقول.'; }
    }

    // 5. إرسال المعاملة WFS-T إلى GeoServer (الحفظ الفعلي)
    function sendWFS_T(feature, type) {
        const config = getWFSConfig(activeLayerKey);
        const featureNS = config.uri;
        let payload = '';

        if (type === 'insert') {
            let fields = `<${config.ws}:${config.type} xmlns:${config.ws}="${featureNS}">`;
            // إضافة الهندسة
            const coords = feature.getGeometry().getCoordinates();
            const gmlGeom = config.geometryType === 'Polygon' 
                ? `<${config.ws}:geom><gml:Polygon srsName="EPSG:28191"><gml:exterior><gml:LinearRing><gml:coordinates>${coords[0].map(c => c.join(',')).join(' ')}</gml:coordinates></gml:LinearRing></gml:exterior></gml:Polygon></${config.ws}:geom>`
                : `<${config.ws}:geom><gml:LineString srsName="EPSG:28191"><gml:coordinates>${coords.map(c => c.join(',')).join(' ')}</gml:coordinates></gml:LineString></${config.ws}:geom>`;
            
            fields += gmlGeom;
            // إضافة الخصائص
            const props = feature.getProperties();
            for (let key in props) {
                if (key !== 'geometry' && key !== 'geom') {
                    fields += `<${config.ws}:${key}>${props[key]}</${config.ws}:${key}>`;
                }
            }
            fields += `</${config.ws}:${config.type}>`;
            payload = `<wfs:Insert>${fields}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            let updates = '';
            const props = feature.getProperties();
            for (let key in props) {
                if (key !== 'geometry' && key !== 'geom') {
                    updates += `<wfs:Property><wfs:Name>${key}</wfs:Name><wfs:Value>${props[key]}</wfs:Value></wfs:Property>`;
                }
            }
            payload = `<wfs:Update typeName="${config.ws}:${config.type}">${updates}<ogc:Filter><ogc:FeatureId fid="${feature.getId()}"/></ogc:Filter></wfs:Update>`;
        }
        else if (type === 'delete') {
            payload = `<wfs:Delete typeName="${config.ws}:${config.type}"><ogc:Filter><ogc:FeatureId fid="${feature.getId()}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `
            <wfs:Transaction service="WFS" version="1.1.0" 
                xmlns:wfs="http://www.opengis.net/wfs" 
                xmlns:gml="http://www.opengis.net/gml" 
                xmlns:ogc="http://www.opengis.net/ogc" 
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
                ${payload}
            </wfs:Transaction>`;

        fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            body: requestXML,
            headers: { 'Content-Type': 'text/xml' }
        }).then(res => {
            if (res.ok) {
                alert('تم الحفظ في قاعدة البيانات بنجاح!');
                selectedLayerSource.refresh();
                deactivatePolygonEditTools();
            } else alert('فشل الحفظ. تأكد من إعدادات الـ Workspace في GeoServer.');
        });
    }

    // ربط الأزرار
    populatePolygonLayers();
    if (addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if (modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if (deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if (submitAttributesBtn) submitAttributesBtn.onclick = () => {
        const formData = new FormData(attributeForm);
        formData.forEach((val, key) => currentFeature.set(key, val));
        sendWFS_T(currentFeature, currentTransactionType);
    };
    if (cancelAttributesBtn) cancelAttributesBtn.onclick = () => {
        if (currentTransactionType === 'insert') selectedLayerSource.removeFeature(currentFeature);
        deactivatePolygonEditTools();
    };
}