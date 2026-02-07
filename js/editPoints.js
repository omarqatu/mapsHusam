/**
 * js/editPoints.js - النسخة المعدلة بالكامل لحل مشكلة التعديل والحذف
 */
function initializeEditTools(map, overlayLayersObj, enableAllDefaultInteractions) {
    let draw, modify, snap, select, translate;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerName;

    const editLayerSelect = document.getElementById('edit-layer-select');
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    const config = {
        realestate: {
            layers: ['rentLayer', 'saleLayer', 'landLayer'],
            fields: ['price', 'des', 'pic', 'video', 'area'],
            pk: 'fid',
            ns: 'realestate',
            uri: 'http://localhost:8080/geoserver/realestate'
        },
        services: {
            layerMapping: {
                'electricianLayer': 'electrician',
                'plumberLayer': 'plumber'
            },
            fields: ['name', 'whatsapp', 'pic', 'details_link_1', 'details_link_2'],
            pk: 'id',
            ns: 'services',
            // تحديث الرابط ليكون مطابقاً لما يطلبه السيرفر في رسائل الخطأ
            uri: 'http://localhost/services' 
        }
    };

    const labels = {
        'price': 'السعر/الإيجار', 'des': 'الوصف الكامل', 'area': 'المساحة',
        'pic': 'رابط الصورة', 'video': 'رابط الفيديو', 'name': 'الاسم',
        'whatsapp': 'الواتساب', 'details_link_1': 'تفاصيل 1', 'details_link_2': 'تفاصيل 2'
    };

    function escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&"']/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '"': return '&quot;';
                case "'": return '&apos;';
                default: return c;
            }
        });
    }

    function deactivate() {
        [draw, modify, snap, select, translate].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = translate = null;
        map.getTargetElement().style.cursor = '';
        if (typeof window.setPopupState === 'function') window.setPopupState(true);
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(b => b?.classList.remove('active'));
        attributeModal.style.display = 'none';
    }

    function setupInteractions(mode) {
        deactivate();
        selectedLayerName = editLayerSelect.value;
        if (!selectedLayerName) return alert('يرجى اختيار طبقة أولاً');
        
        const layer = overlayLayersObj[selectedLayerName];
        if (!layer) return alert('الطبقة غير موجودة في الخريطة');
        selectedLayerSource = layer.getSource();

        if (mode === 'add') {
            addFeatureBtn.classList.add('active');
            draw = new ol.interaction.Draw({ source: selectedLayerSource, type: 'Point' });
            draw.on('drawend', (e) => { 
                currentFeature = e.feature; 
                currentTransactionType = 'insert'; 
                openModal(currentFeature); 
            });
            map.addInteraction(draw);
        } else if (mode === 'modify') {
            modifyFeatureBtn.classList.add('active');
            select = new ol.interaction.Select({ layers: [layer] });
            translate = new ol.interaction.Translate({ features: select.getFeatures() });
            map.addInteraction(select);
            map.addInteraction(translate);
            translate.on('translateend', (e) => {
                if (e.features.getArray().length > 0) {
                    currentFeature = e.features.getArray()[0];
                    currentTransactionType = 'update';
                    openModal(currentFeature);
                }
            });
        } else if (mode === 'delete') {
            deleteFeatureBtn.classList.add('active');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                currentFeature = e.selected[0];
                if (currentFeature && confirm('هل أنت متأكد من الحذف النهائي؟')) sendWFS(currentFeature, 'delete');
            });
        }
    }

    function openModal(feature) {
        attributeForm.innerHTML = '';
        const isRE = config.realestate.layers.includes(selectedLayerName);
        const fields = isRE ? config.realestate.fields : config.services.fields;
        fields.forEach(f => {
            const val = feature.get(f) || '';
            attributeForm.innerHTML += `
                <div style="margin-bottom:12px;">
                    <label style="display:block;font-weight:bold;margin-bottom:5px;">${labels[f] || f}</label>
                    <input class="form-control" name="${f}" value="${val}">
                </div>`;
        });
        attributeModal.style.display = 'block';
    }

    function sendWFS(feature, type) {
        const isRE = config.realestate.layers.includes(selectedLayerName);
        const activeConfig = isRE ? config.realestate : config.services;
        const ns = activeConfig.ns;
        const nsUrl = activeConfig.uri;
        
        let gType;
        if (isRE) {
            if (selectedLayerName === 'rentLayer') gType = 'ApartRent';
            else if (selectedLayerName === 'saleLayer') gType = 'ApartSale';
            else if (selectedLayerName === 'landLayer') gType = 'LandSale';
        } else {
            gType = config.services.layerMapping[selectedLayerName] || selectedLayerName.replace('Layer', '');
        }

        const coords = feature.getGeometry().getCoordinates();
        const pkField = activeConfig.pk;
        
        // استخراج الـ ID بشكل دقيق
        let featureFullId = feature.getId(); 
        let rawId;
        if (featureFullId) {
            rawId = featureFullId.split('.').pop();
        } else {
            rawId = feature.get(pkField);
        }

        const props = {};
        if (type !== 'delete') {
            new FormData(attributeForm).forEach((v, k) => { if (k !== pkField) props[k] = v; });
            props['x_coord'] = coords[0].toFixed(3);
            props['y_coord'] = coords[1].toFixed(3);
            props['status'] = 0;
            if (isRE) { 
                props['X'] = coords[0]; 
                props['Y'] = coords[1]; 
            } else { 
                props['x_global'] = coords[0]; 
                props['y_global'] = coords[1]; 
                props['rating'] = 0; 
            }
        }

        let operation = '';
        if (type === 'insert') {
            let fields = `<${ns}:${gType} xmlns:${ns}="${nsUrl}">`;
            fields += `<${ns}:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></${ns}:geom>`;
            for (let k in props) {
                fields += `<${ns}:${k}>${escapeXml(props[k])}</${ns}:${k}>`;
            }
            fields += `</${ns}:${gType}>`;
            operation = `<wfs:Insert>${fields}</wfs:Insert>`;
        } else if (type === 'update') {
            let ups = '';
            for (let k in props) {
                ups += `<wfs:Property><wfs:Name>${ns}:${k}</wfs:Name><wfs:Value>${escapeXml(props[k])}</wfs:Value></wfs:Property>`;
            }
            ups += `<wfs:Property><wfs:Name>${ns}:geom</wfs:Name><wfs:Value><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></wfs:Value></wfs:Property>`;
            // تحديد الـ typeName مع الـ Namespace بوضوح
            operation = `<wfs:Update typeName="${ns}:${gType}">${ups}<ogc:Filter><ogc:FeatureId fid="${gType}.${rawId}"/></ogc:Filter></wfs:Update>`;
        } else if (type === 'delete') {
            operation = `<wfs:Delete typeName="${ns}:${gType}"><ogc:Filter><ogc:FeatureId fid="${gType}.${rawId}"/></ogc:Filter></wfs:Delete>`;
        }

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
        <wfs:Transaction service="WFS" version="1.1.0" 
            xmlns:wfs="http://www.opengis.net/wfs" 
            xmlns:gml="http://www.opengis.net/gml" 
            xmlns:ogc="http://www.opengis.net/ogc" 
            xmlns:${ns}="${nsUrl}">
            ${operation}
        </wfs:Transaction>`;

        fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            body: xml,
            headers: { 'Content-Type': 'text/xml' }
        }).then(res => res.text()).then(data => {
            // التحقق من نجاح العملية بأكثر من وسيلة (Summary أو success)
            if (data.includes('TransactionSummary') || data.includes('success="true"') || data.includes('totalInserted="1"') || data.includes('totalUpdated="1"') || data.includes('totalDeleted="1"')) {
                alert('تمت العملية بنجاح');
                if (selectedLayerSource.refresh) selectedLayerSource.refresh();
                location.reload(); 
                deactivate();
            } else {
                console.error('GeoServer Response:', data);
                alert('فشل في الحفظ. تأكد من إعدادات الـ Workspace أو البيانات المدخلة.');
            }
        }).catch(err => {
            console.error('Fetch error:', err);
            alert('حدث خطأ في الشبكة.');
        });
    }

    addFeatureBtn.onclick = () => setupInteractions('add');
    modifyFeatureBtn.onclick = () => setupInteractions('modify');
    deleteFeatureBtn.onclick = () => setupInteractions('delete');
    submitAttributesBtn.onclick = () => sendWFS(currentFeature, currentTransactionType);
    cancelAttributesBtn.onclick = () => { 
        if(currentTransactionType === 'insert' && currentFeature) selectedLayerSource.removeFeature(currentFeature); 
        deactivate(); 
    };
}