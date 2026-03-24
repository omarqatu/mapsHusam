/**
 * editPoints.js - النسخة الشاملة والمعدلة (المنهجية الكاملة)
 * تم دمج منهجية المهندس حسام مع إصلاحات WFS-T لضمان عمل الـ 34 خدمة والشقق.
 */

function initializeEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerName; 
    let featureProperties = {};

    // الربط مع عناصر الـ DOM
    const editLayerSelect = document.getElementById('edit-layer-select');
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    const labelsRealEstate = {
        'price': 'السعر ($)', 'des': 'وصف العقار', 'area': 'مساحة العقار',
        'whatsapp': 'رقم الواتساب', 'pic': 'رابط الصورة/بوست (Link)',
        'video': 'رابط فيديو/وصف إضافي (Link)', 'end_date': 'تاريخ انتهاء الاشتراك',
        'work_hours': 'ساعات العمل (مثال: 08:00-16:00)'
    };

    const labelsServices = {
        'name': 'اسم مزود الخدمة', 'whatsapp': 'رقم الواتساب', 'pic': 'رابط العرض (Link)',
        'rating': 'التقييم (1-10)', 'details_link_1': 'رابط تفاصيل 1',
        'details_link_2': 'رابط تفاصيل 2', 'end_date': 'تاريخ انتهاء الاشتراك',
        'work_hours': 'ساعات العمل'
    };

    function escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        if (typeof unsafe !== 'string') return unsafe;
        return unsafe.replace(/[<>&"']/g, (ch) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
        }[ch]));
    }

    function populatePointLayers() {
        if (!editLayerSelect) return;
        editLayerSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
        const serviceKeys = window.serviceTranslations ? Object.keys(window.serviceTranslations) : [];

        Object.keys(overlayLayersObj).forEach(key => {
            const layer = overlayLayersObj[key];
            const source = layer.getSource();
            if (!(source instanceof ol.source.Vector)) return;
            if (key === 'landLayer') return; 

            const isRealEstate = ['rentLayer', 'saleLayer'].includes(key);
            const isService = serviceKeys.some(sKey => key.toLowerCase().includes(sKey.toLowerCase())) || key.toLowerCase().includes('layer');

            if (isRealEstate || isService) {
                const opt = document.createElement('option');
                opt.value = key; 
                opt.textContent = layer.get('title') || key;
                editLayerSelect.appendChild(opt);
            }
        });
    }

    function deactivatePointEditTools() {
        [draw, modify, snap, select].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = null;
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active'));
        if (attributeModal) attributeModal.style.display = 'none';
    }

    function setupInteractions(mode) {
        deactivatePointEditTools();
        selectedLayerName = editLayerSelect.value;
        if (!selectedLayerName) return alert('يرجى اختيار طبقة أولاً من القائمة');

        const layer = overlayLayersObj[selectedLayerName];
        selectedLayerSource = layer.getSource();

        if (mode === 'add') {
            addFeatureBtn.classList.add('active');
            draw = new ol.interaction.Draw({ source: selectedLayerSource, type: 'Point' });
            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                showAttributeModal(currentFeature);
            });
            map.addInteraction(draw);
        } 
        else if (mode === 'modify') {
            modifyFeatureBtn.classList.add('active');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            modify = new ol.interaction.Modify({ features: select.getFeatures() });
            map.addInteraction(modify);

            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                currentFeature = e.selected[0];
                currentTransactionType = 'update';
                showAttributeModal(currentFeature);
            });
        } 
        else if (mode === 'delete') {
            deleteFeatureBtn.classList.add('active');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                currentFeature = e.selected[0];
                if (confirm('هل أنت متأكد من حذف هذا المعلم نهائياً؟')) {
                    sendWFS_T(currentFeature, 'delete');
                }
                select.getFeatures().clear();
            });
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    function showAttributeModal(feature) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة معلم جديد' : 'تعديل البيانات';
        attributeForm.innerHTML = '';
        attributeModal.style.display = 'block';

        const isRealEstate = ['rentLayer', 'saleLayer'].includes(selectedLayerName);
        const activeLabels = isRealEstate ? labelsRealEstate : labelsServices;

        Object.keys(activeLabels).forEach(fieldName => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.style.marginBottom = '10px';
            div.style.textAlign = 'right';

            let currentValue = feature.get(fieldName) || '';
            if (fieldName === 'end_date' && currentValue) {
                currentValue = currentValue.toString().split('T')[0].replace('Z', '');
            }

            let inputHTML = '';
            if (fieldName === 'end_date') {
                inputHTML = `<input type="date" name="${fieldName}" value="${currentValue}" required style="width:100%; padding:5px;">`;
            } else if (fieldName === 'work_hours') {
                inputHTML = `<div style="display:flex; gap:5px;"><input type="text" id="work_hours_input" name="${fieldName}" value="${currentValue}" placeholder="08:00-16:00" style="flex:1;"><button type="button" onclick="document.getElementById('work_hours_input').value='00:00-23:59'">24س</button></div>`;
            } else if (fieldName === 'rating') {
                inputHTML = `<input type="number" name="${fieldName}" min="1" max="10" value="${currentValue || 5}" style="width:100%;">`;
            } else {
                inputHTML = `<input type="text" name="${fieldName}" value="${currentValue}" required style="width:100%; padding:5px;">`;
            }

            div.innerHTML = `<label style="display:block; font-weight:bold;">${activeLabels[fieldName]}:</label>${inputHTML}`;
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        const formData = new FormData(attributeForm);
        featureProperties = {};
        formData.forEach((val, key) => { featureProperties[key] = val; });

        const coordsPal = currentFeature.getGeometry().getCoordinates();
        const coordsGlobal = ol.proj.toLonLat(coordsPal, 'EPSG:28191');
        const isRealEstate = ['rentLayer', 'saleLayer'].includes(selectedLayerName);

        if (currentTransactionType === 'insert') {
            const uniqueId = Math.floor(Math.random() * 900000) + 100000;
            featureProperties[isRealEstate ? 'fid' : 'id'] = uniqueId;
            featureProperties['start_date'] = new Date().toISOString().split('T')[0];
            featureProperties['status'] = 0;
            featureProperties['auto_status'] = 0;
        }

        featureProperties['x_coord'] = coordsPal[0].toFixed(2);
        featureProperties['y_coord'] = coordsPal[1].toFixed(2);
        
        if (isRealEstate) {
            featureProperties['X'] = coordsGlobal[0].toFixed(6);
            featureProperties['Y'] = coordsGlobal[1].toFixed(6);
        } else {
            featureProperties['x_global'] = coordsGlobal[0].toFixed(6);
            featureProperties['y_global'] = coordsGlobal[1].toFixed(6);
        }

        currentFeature.setProperties(featureProperties);
        sendWFS_T(currentFeature, currentTransactionType);
        attributeModal.style.display = 'none';
    }

    function sendWFS_T(feature, type) {
        const isRealEstate = ['rentLayer', 'saleLayer'].includes(selectedLayerName);
        const workspace = isRealEstate ? 'realestate' : 'services';
        
        let typeName = selectedLayerName.replace('Layer', ''); 
        if (selectedLayerName === 'rentLayer') typeName = 'ApartRent';
        if (selectedLayerName === 'saleLayer') typeName = 'ApartSale';

        const featureNS = `http://localhost:8080/geoserver/${workspace}`;
        const coords = feature.getGeometry().getCoordinates();
        
        // جلب الـ ID - أساسي للحذف والتعديل
        let fidValue = feature.getId();
        if (!fidValue) {
            const rawId = isRealEstate ? feature.get('fid') : feature.get('id');
            fidValue = `${typeName}.${rawId}`;
        }

        let payload = '';
        if (type === 'insert') {
            let fieldsXML = `<${workspace}:${typeName} xmlns:${workspace}="${featureNS}">`;
            fieldsXML += `<${workspace}:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></${workspace}:geom>`;
            for (let k in featureProperties) {
                if (['geom', 'geometry', 'boundedBy'].includes(k)) continue;
                fieldsXML += `<${workspace}:${k}>${escapeXml(featureProperties[k])}</${workspace}:${k}>`;
            }
            fieldsXML += `</${workspace}:${typeName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            let props = '';
            const allProps = feature.getProperties();
            for (let k in allProps) {
                if (['geom', 'geometry', 'boundedBy', 'id', 'fid'].includes(k)) continue;
                // إصلاح: إضافة البادئة (Prefix) لاسم الحقل في التعديل
                props += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(allProps[k])}</wfs:Value></wfs:Property>`;
            }
            props += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></wfs:Value></wfs:Property>`;
            payload = `<wfs:Update typeName="${workspace}:${typeName}">${props}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } 
        else if (type === 'delete') {
            payload = `<wfs:Delete typeName="${workspace}:${typeName}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `
            <wfs:Transaction service="WFS" version="1.1.0" 
                xmlns:wfs="http://www.opengis.net/wfs" 
                xmlns:gml="http://www.opengis.net/gml" 
                xmlns:ogc="http://www.opengis.net/ogc"
                xmlns:services="http://localhost:8080/geoserver/services"
                xmlns:realestate="http://localhost:8080/geoserver/realestate">
                ${payload}
            </wfs:Transaction>`;

        fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            body: requestXML,
            headers: { 'Content-Type': 'text/xml' }
        }).then(async res => {
            const text = await res.text();
            if (res.ok && !text.includes('Exception')) {
                alert('تمت العملية بنجاح!');
                selectedLayerSource.refresh(); 
                deactivatePointEditTools();
            } else {
                console.error("GeoServer Response:", text);
                alert('خطأ: تأكد من مسميات الحقول في GeoServer وصلاحيات الـ Workspace.');
            }
        }).catch(err => alert('خطأ اتصال: ' + err));
    }

    populatePointLayers();
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => deactivatePointEditTools();
}