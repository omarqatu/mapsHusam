/**
 * editLines.js - نسخة الاستقرار الشاملة 2026
 * معالجة تعارض الأسماء + حل مشكلة الـ Insert + ضبط أنواع البيانات الرقمية للشبكات المتقدمة و pgRouting
 */
window.initializeLineEditTools = function (map, overlayLayersObj) {
    let draw, modify, snap, select;
    let currentFeature;
    let currentTransactionType;
    let originalFeatureId; // حفظ المعرف الأصلي لضمان نجاح التحديث
    
    const geometryAttrName = 'geom';
    const targetSRS = 'EPSG:28191';
    const featurePrefix = 'realestate';
    const featureNS = 'http://localhost:8080/geoserver/realestate';
    const geoServerFeatureType = 'RoadsTest';
    const roadsLayerKey = 'roadsLayer'; 

    const addFeatureBtn = document.getElementById('line-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('line-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('line-delete-feature-btn');
    const attributeModal = document.getElementById('lineAttributeModal');
    const attributeForm = document.getElementById('lineAttributeForm');
    const submitAttributesBtn = document.getElementById('lineSubmitAttributes');
    const cancelAttributesBtn = document.getElementById('lineCancelAttributes');

    function escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&"']/g, (ch) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
        }[ch]));
    }

    function getActiveLayerSource() {
        return overlayLayersObj[roadsLayerKey]?.getSource();
    }

    function getRegionalData(geometry) {
        const locationLayer = overlayLayersObj['locationLayer'];
        if (!locationLayer) return { gov_a: 'غير محدد', village_a: 'غير محدد' };
        const coord = geometry.getFirstCoordinate();
        const features = locationLayer.getSource().getFeatures();
        for (let f of features) {
            if (f.getGeometry().intersectsCoordinate(coord)) {
                return {
                    gov_a: f.get('gov_a') || 'غير محدد',
                    village_a: f.get('village_a') || 'غير محدد'
                };
            }
        }
        return { gov_a: 'غير محدد', village_a: 'غير محدد' };
    }

    window.deactivateLineEditTools = function() {
        if (draw) map.removeInteraction(draw);
        if (modify) map.removeInteraction(modify);
        if (snap) map.removeInteraction(snap);
        if (select) map.removeInteraction(select);
        draw = modify = snap = select = null;
        map.getTargetElement().style.cursor = '';
        if (attributeModal) attributeModal.style.display = 'none';
        currentFeature = null;
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active-tool'));
    };

    function setupInteractions(mode) {
        window.deactivateLineEditTools();
        const source = getActiveLayerSource();
        if (!source) return alert('خطأ: طبقة الطرق غير محملة أو المفتاح roadsLayer غير صحيح');
        const layer = overlayLayersObj[roadsLayerKey];

        if (mode === 'add') {
            addFeatureBtn?.classList.add('active-tool');
            map.getTargetElement().style.cursor = 'crosshair';
            
            draw = new ol.interaction.Draw({ source: source, type: 'LineString' });
            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                originalFeatureId = null;
                setTimeout(() => showAttributeModal(currentFeature), 250);
            });
            map.addInteraction(draw);
        } else if (mode === 'modify') {
            modifyFeatureBtn?.classList.add('active-tool');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            
            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                currentFeature = e.selected[0];
                currentTransactionType = 'update';
                originalFeatureId = currentFeature.getId(); // تخزين الـ FID فوراً
                
                modify = new ol.interaction.Modify({ features: select.getFeatures() });
                map.addInteraction(modify);
                map.getTargetElement().style.cursor = 'copy';
                showAttributeModal(currentFeature);
            });
        } else if (mode === 'delete') {
            deleteFeatureBtn?.classList.add('active-tool');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                if (e.selected.length > 0 && confirm('🗑️ هل أنت متأكد من حذف هذا الطريق؟')) {
                    sendWFS_T(e.selected[0], 'delete');
                }
                select.getFeatures().clear();
            });
        }
        snap = new ol.interaction.Snap({ source: source });
        map.addInteraction(snap);
    }

    function showAttributeModal(feature) {
        if (!attributeForm || !attributeModal) return;
        attributeForm.innerHTML = ''; 
        
        const editableFields = [
            { name: 'name', label: 'اسم الطريق (Varying)', type: 'text' },
            { name: 'road_type', label: 'نوع الطريق (Integer)', type: 'number' },
            { name: 'one_way', label: 'اتجاه السير (BigInt)', type: 'number' }
        ];
        
        editableFields.forEach(field => {
            const container = document.createElement('div');
            container.style.marginBottom = '12px';
            const label = document.createElement('label');
            label.textContent = field.label;
            label.style.display = 'block';
            label.style.fontWeight = 'bold';
            const input = document.createElement('input');
            input.name = field.name;
            input.type = field.type;
            input.className = 'form-control';
            let val = feature.get(field.name);
            input.value = (val !== undefined && val !== null) ? val : '';
            container.appendChild(label);
            container.appendChild(input);
            attributeForm.appendChild(container);
        });
        attributeModal.style.display = 'block';
    }

    function submitAttributes() {
        if (!currentFeature) return;
        const formData = new FormData(attributeForm);
        const props = {};
        
        formData.forEach((value, key) => {
            if (key === 'name') {
                props[key] = value.trim() ? String(value) : "طريق جديد"; 
            } else {
                props[key] = (value === "" || value === null) ? 0 : parseInt(value);
            }
        });

        const regional = getRegionalData(currentFeature.getGeometry());
        props['gov_a'] = regional.gov_a || "غير محدد";
        props['village_a'] = regional.village_a || "غير محدد";

        if (currentTransactionType === 'insert') {
            props['source'] = 0;
            props['target'] = 0;
            props['cost'] = 0.0;
        }

        currentFeature.setProperties(props);
        if (attributeModal) attributeModal.style.display = 'none';
        sendWFS_T(currentFeature, currentTransactionType);
    }

    function sendWFS_T(feature, type) {
        const source = getActiveLayerSource();
        const fullQualifiedName = `${featurePrefix}:${geoServerFeatureType}`;
        
        // ضمان الحصول على المعرف الصحيح للتحديث من الذاكرة أو المعلم
        let rawId = originalFeatureId || feature.getId() || feature.get('id');
        let cleanId = (rawId && String(rawId).includes('.')) ? rawId.split('.').pop() : rawId;
        const fidValue = cleanId ? `${geoServerFeatureType}.${cleanId}` : "";

        let geom = feature.getGeometry().clone();
        const viewProjection = map.getView().getProjection() ? map.getView().getProjection().getCode() : targetSRS;
        if (viewProjection !== targetSRS) geom.transform(viewProjection, targetSRS);

        // [إصلاح حاسم]: تحويل الهندسة إلى MultiLineString ليتوافق مع إعدادات الجيوسيرفر (GML 3)
        const coords = (geom.getType() === 'MultiLineString') ? geom.getCoordinates() : [geom.getCoordinates()];
        let gmlGeometry = `<gml:MultiLineString srsName="${targetSRS}" xmlns:gml="http://www.opengis.net/gml">`;
        coords.forEach(line => {
            gmlGeometry += `<gml:lineStringMember><gml:LineString><gml:posList>${line.map(c => `${c[0]} ${c[1]}`).join(' ')}</gml:posList></gml:LineString></gml:lineStringMember>`;
        });
        gmlGeometry += `</gml:MultiLineString>`;

        let payload = '';
        const props = Object.assign({}, feature.getProperties());
        
        // تنظيف الحقول من أي معرفات قديمة قد تسبب تعارضاً عند الإضافة الجديدة
        const fieldsToExclude = ['geometry', 'geom', 'id', 'fid', 'objectid', 'boundedBy', 'id_0', 'layer'];
        fieldsToExclude.forEach(f => delete props[f]);

        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${featurePrefix}="${featureNS}">`;
            fieldsXML += `<${featurePrefix}:${geometryAttrName}>${gmlGeometry}</${featurePrefix}:${geometryAttrName}>`;
            for (let k in props) {
                const val = props[k];
                // لا ترسل الحقول الفارغة تماماً لتجنب مشاكل الـ Null في قاعدة البيانات
                if (val !== null && val !== undefined && String(val).trim() !== "") {
                    fieldsXML += `<${featurePrefix}:${k}>${escapeXml(val)}</${featurePrefix}:${k}>`;
                }
            }
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            let propsXML = '';
            for (let k in props) {
                let val = props[k];
                if (val === null || val === undefined || val === "") val = (typeof val === 'number') ? 0 : " ";
                // [إصلاح حاسم]: إزالة البادئة من اسم الحقل في Update لضمان قبول السيرفر
                propsXML += `<wfs:Property><wfs:Name>${k}</wfs:Name><wfs:Value>${escapeXml(val)}</wfs:Value></wfs:Property>`;
            }
            propsXML += `<wfs:Property><wfs:Name>${geometryAttrName}</wfs:Name><wfs:Value>${gmlGeometry}</wfs:Value></wfs:Property>`;
            payload = `<wfs:Update typeName="${fullQualifiedName}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } 
        else if (type === 'delete') {
            payload = `<wfs:Delete typeName="${fullQualifiedName}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        // تنظيف الطلب من المسافات الفارغة الزائدة لضمان صحة معالجة الـ XML في السيرفر
        const requestXML = `<?xml version="1.0" encoding="UTF-8"?><wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:${featurePrefix}="${featureNS}">${payload}</wfs:Transaction>`;

        fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            body: requestXML,
            headers: { 'Content-Type': 'text/xml' }
        }).then(async res => {
            const text = await res.text();
            if (res.ok && !text.includes('Exception')) {
                alert('✅ تمت العملية بنجاح');
                source.refresh();
                window.deactivateLineEditTools();
            } else {
                console.error("GeoServer Response:", text);
                let errorMatch = text.match(/<ows:ExceptionText>(.*?)<\/ows:ExceptionText>/);
                let detailedError = errorMatch ? errorMatch[1] : "فشل في إدراج البيانات - تأكد من صلاحيات الـ Sequence";
                alert('❌ خطأ: ' + detailedError);
            }
        }).catch(err => {
            console.error("Network Error:", err);
            alert('❌ فشل الاتصال بالسيرفر');
        });
    }

    if (addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if (modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if (deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if (submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if (cancelAttributesBtn) cancelAttributesBtn.onclick = () => {
        if(currentTransactionType === 'insert' && currentFeature) getActiveLayerSource()?.removeFeature(currentFeature);
        window.deactivateLineEditTools();
    };
};