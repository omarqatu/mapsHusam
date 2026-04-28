/**
 * editPoints.js - النسخة المعدلة بالكامل 2026
 * معالجة الواتساب بناءً على المدخل المباشر بالمقدمة الدولية
 */
function initializeEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerName;
    let featureProperties = {};
    let isWaitingForNewLocation = false;

    // عناصر الواجهة
    const editLayerSelect = document.getElementById('edit-layer-select');
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    // الطبقات التي تتبع تصنيف العقارات (نقاط)
    const realEstateLayers = ['rentLayer', 'saleLayer']; 

    // تعريف الحقول (العقارات) - تم تحديث الملاحظة للمستخدم
    const fieldsRealEstate = [
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'des', label: 'وصف العقار', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'video', label: 'رابط الفيديو', type: 'url' },
        { name: 'area', label: 'المساحة (م٢)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الواتساب (بالمقدمة مثلا 00970)', type: 'text' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' }
    ];

    // تعريف الحقول (الخدمات)
    const fieldsServices = [
        { name: 'name', label: 'اسم مزود الخدمة', type: 'text' },
        { name: 'whatsapp', label: 'رقم الواتساب (بالمقدمة مثلا 00970)', type: 'text' },
        { name: 'des', label: 'وصف الخدمة والخبرة', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'rating', label: 'التقييم (1-10)', type: 'number', min: 1, max: 10 },
        { name: 'details_link_1', label: 'رابط تفاصيل 1', type: 'url' },
        { name: 'details_link_2', label: 'رابط تفاصيل 2', type: 'url' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' }
    ];

    function escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&"']/g, (ch) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
        }[ch]));
    }

    function populatePointLayers() {
        if (!editLayerSelect) return;
        editLayerSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
        if (!overlayLayersObj) return;

        Object.keys(overlayLayersObj).forEach(key => {
            const layer = overlayLayersObj[key];
            if (!layer || !(layer.getSource() instanceof ol.source.Vector)) return;

            const excluded = [
                'locationLayer', 'cityLayer', 'landLayer', 'governorateLayer',
                'roadsLayer', 'searchMarkerLayer', 'searchResultsHighlightLayer',
                'landSaleLayer', 'villagesLayer', 'governoratesLayer', 'areasLayer'
            ];
            
            if (excluded.includes(key)) return;

            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = layer.get('title') || key;
            editLayerSelect.appendChild(opt);
        });
    }

    function deactivatePointEditTools() {
        [draw, modify, snap, select].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = null;
        isWaitingForNewLocation = false;
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
        if (attributeModal) attributeModal.style.display = 'none';
        map.getTargetElement().style.cursor = '';
        currentFeature = null;
        featureProperties = {};
    }

    map.on('singleclick', (evt) => {
        if (isWaitingForNewLocation && currentFeature) {
            const newCoords = evt.coordinate;
            currentFeature.getGeometry().setCoordinates(newCoords);
            isWaitingForNewLocation = false;
            map.getTargetElement().style.cursor = '';
            sendWFS_T(currentFeature, 'update');
        }
    });

    function setupInteractions(mode) {
        deactivatePointEditTools();
        selectedLayerName = editLayerSelect.value;
        if (!selectedLayerName) return alert('يرجى اختيار طبقة أولاً');
        
        const layer = overlayLayersObj[selectedLayerName];
        if (!layer) return alert('خطأ: الطبقة غير موجودة');

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
        } else {
            const btn = (mode === 'modify') ? modifyFeatureBtn : deleteFeatureBtn;
            if (btn) btn.classList.add('active');
            
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                currentFeature = e.selected[0];
                if (mode === 'delete') {
                    if (confirm('هل أنت متأكد من حذف هذا المعلم؟')) sendWFS_T(currentFeature, 'delete');
                    select.getFeatures().clear();
                    deactivatePointEditTools();
                } else {
                    currentTransactionType = 'update';
                    showAttributeModal(currentFeature);
                }
            });
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    function showAttributeModal(feature) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة معلم جديد' : 'تعديل البيانات';
        attributeForm.innerHTML = '';
        attributeModal.style.display = 'block';

        const isRealEstate = realEstateLayers.includes(selectedLayerName);
        const activeFields = isRealEstate ? fieldsRealEstate : fieldsServices;

        activeFields.forEach(f => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.style.marginBottom = '12px';
            div.style.textAlign = 'right';

            let val = feature.get(f.name);
            if (val === undefined || val === null) val = '';

            if (f.type === 'date' && val) {
                try { val = new Date(val).toISOString().split('T')[0]; } catch(e) { val = ''; }
            }

            let inputHTML = '';
            if (f.type === 'hours') {
                inputHTML = `<div style="display:flex; gap:5px;">
                                <input type="text" id="inp_${f.name}" name="${f.name}" value="${val || ''}" style="flex:1; padding:8px;">
                                <button type="button" onclick="document.getElementById('inp_${f.name}').value='00:00-23:59'" style="cursor:pointer;">24 ساعة</button>
                             </div>`;
            } else if (f.type === 'date') {
                inputHTML = `<input type="date" name="${f.name}" value="${val}" style="width:100%; padding:8px;">`;
            } else if (f.type === 'number') {
                inputHTML = `<input type="number" name="${f.name}" value="${val}" step="any" style="width:100%; padding:8px;">`;
            } else {
                inputHTML = `<input type="text" name="${f.name}" value="${val}" style="width:100%; padding:8px;">`;
            }

            div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:4px;">${f.label}:</label>${inputHTML}`;
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        const formData = new FormData(attributeForm);
        const isRealEstate = realEstateLayers.includes(selectedLayerName);
        const activeFields = isRealEstate ? fieldsRealEstate : fieldsServices;

        activeFields.forEach(f => {
            let val = formData.get(f.name);
            
            // معالجة الواتساب: تنظيف المسافات فقط وحفظ الرقم كما هو مدخل
            if (f.name === 'whatsapp' && val) {
                val = val.replace(/\s/g, '');
            }
            featureProperties[f.name] = (f.type === 'number') ? (val === "" ? null : Number(val)) : val;
        });

        const coordsPal = currentFeature.getGeometry().getCoordinates();
        const coordsGlobal = ol.proj.toLonLat(coordsPal, 'EPSG:28191');

        featureProperties['x_coord'] = Number(coordsPal[0].toFixed(2));
        featureProperties['y_coord'] = Number(coordsPal[1].toFixed(2));

        if (isRealEstate) {
            featureProperties['X'] = Number(coordsGlobal[0].toFixed(6));
            featureProperties['Y'] = Number(coordsGlobal[1].toFixed(6));
        } else {
            featureProperties['x_global'] = Number(coordsGlobal[0].toFixed(6));
            featureProperties['y_global'] = Number(coordsGlobal[1].toFixed(6));
        }

        if (currentTransactionType === 'insert') {
            featureProperties['start_date'] = new Date().toISOString().split('T')[0];
        }
        featureProperties['status'] = 0;
        featureProperties['auto_status'] = 0;

        currentFeature.setProperties(featureProperties);
        attributeModal.style.display = 'none';

        if (currentTransactionType === 'update') {
            alert('تم حفظ البيانات. إذا كنت تريد تغيير الموقع، انقر على المكان الجديد على الخريطة، أو سيتم الحفظ في الموقع الحالي.');
            isWaitingForNewLocation = true;
            map.getTargetElement().style.cursor = 'crosshair';
            
            setTimeout(() => {
                if (isWaitingForNewLocation) {
                    if (confirm("هل تريد حفظ التعديلات في الموقع الحالي دون تغيير مكان النقطة؟")) {
                        isWaitingForNewLocation = false;
                        sendWFS_T(currentFeature, 'update');
                    }
                }
            }, 5000);
        } else {
            sendWFS_T(currentFeature, currentTransactionType);
        }
    }

    function sendWFS_T(feature, type) {
        const isRealEstate = realEstateLayers.includes(selectedLayerName);
        const workspace = isRealEstate ? 'realestate' : 'services';
        const layer = overlayLayersObj[selectedLayerName];
        
        let featureNS = isRealEstate ? "http://localhost:8080/geoserver/realestate" : "http://localhost/services";
        
        let typeName = "";
        try {
            const source = layer.getSource();
            const url = (typeof source.getUrl === 'function') ? source.getUrl() : "";
            if (url && url.includes('?')) {
                const urlParams = new URLSearchParams(url.split('?')[1]);
                const fullTypeName = urlParams.get('typeName') || urlParams.get('typename') || urlParams.get('layers');
                if (fullTypeName) {
                    typeName = fullTypeName.includes(':') ? fullTypeName.split(':')[1] : fullTypeName;
                }
            }
            if (!typeName) typeName = selectedLayerName.replace('Layer', '').toLowerCase();
        } catch (e) {
            typeName = selectedLayerName.replace('Layer', '').toLowerCase();
        }

        const coords = feature.getGeometry().getCoordinates();
        const fullQualifiedName = `${workspace}:${typeName}`;
        
        let rawId = "";
        const olId = feature.getId();
        if (olId) {
            rawId = olId.includes('.') ? olId.split('.').pop() : olId;
        } else {
            rawId = feature.get('fid') || feature.get('id');
        }
        
        const fidValue = (rawId) ? `${typeName}.${rawId}` : "";
        let payload = '';

        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
            fieldsXML += `<${workspace}:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></${workspace}:geom>`;
            const allProps = feature.getProperties();
            for (let k in allProps) {
                if (['geom', 'geometry', 'boundedBy', 'id', 'fid'].includes(k) || allProps[k] === null || allProps[k] === undefined || allProps[k] === "") continue;
                fieldsXML += `<${workspace}:${k}>${escapeXml(allProps[k])}</${workspace}:${k}>`;
            }
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            if (!fidValue) return alert("خطأ: لم يتم العثور على معرف المعلم (ID).");
            let props = '';
            const allProps = feature.getProperties();
            for (let k in allProps) {
                if (['geom', 'geometry', 'boundedBy', 'id', 'fid'].includes(k) || allProps[k] === null) continue;
                props += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(allProps[k])}</wfs:Value></wfs:Property>`;
            }
            props += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></wfs:Value></wfs:Property>`;
            
            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">
                        ${props}
                        <ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter>
                      </wfs:Update>`;
        } 
        else if (type === 'delete') {
            if (!fidValue) return alert("خطأ: المعرف غير موجود.");
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">
                        <ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter>
                      </wfs:Delete>`;
        }

        const requestXML = `<?xml version="1.0" encoding="UTF-8"?>
            <wfs:Transaction service="WFS" version="1.1.0"
                xmlns:wfs="http://www.opengis.net/wfs"
                xmlns:gml="http://www.opengis.net/gml"
                xmlns:ogc="http://www.opengis.net/ogc"
                xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
                xmlns:${workspace}="${featureNS}"
                xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
                ${payload}
            </wfs:Transaction>`;

        const baseUrl = (window.location.hostname === 'localhost') ? '/proxy/geoserver/wfs' : 'http://localhost:8080/geoserver/wfs';

        fetch(baseUrl, {
            method: 'POST',
            body: requestXML,
            headers: { 'Content-Type': 'text/xml' }
        }).then(async res => {
            const text = await res.text();
            if (res.ok && !text.includes('Exception')) {
                alert('تمت العملية بنجاح!');
                layer.getSource().refresh(); 
                deactivatePointEditTools();
            } else {
                console.error("GeoServer Response Error:", text);
                alert(`فشلت العملية: راجع الـ Workspace.`);
            }
        }).catch(err => {
            console.error("Fetch Error:", err);
            alert('حدث خطأ في الاتصال بالسيرفر.');
        });
    }

    populatePointLayers();

    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => deactivatePointEditTools();
}