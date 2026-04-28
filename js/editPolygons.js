/**
 * editPolygons.js - النسخة الكاملة المحدثة 2026
 * توحيد واجهة تحرير الأراضي مع واجهة تحرير الشقق (نقاط)
 * معالجة الواتساب وساعات العمل والحقول التلقائية
 */
function initializePolygonEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerKey;

    const layerSelect = document.getElementById('polygon-layer-select');
    const addFeatureBtn = document.getElementById('polygon-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('polygon-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('polygon-delete-feature-btn');
    const attributeModal = document.getElementById('polygonAttributeModal');
    const attributeForm = document.getElementById('polygonAttributeForm');
    const modalTitle = document.getElementById('polygonModalTitle');
    const submitAttributesBtn = document.getElementById('polygonSubmitAttributes');
    const cancelAttributesBtn = document.getElementById('polygonCancelAttributes');

    // حقول طبقة الأراضي - مطابقة لحقول الشقق
    const fieldsLand = [
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'des', label: 'وصف العقار', type: 'text' },
        { name: 'area', label: 'المساحة (م²)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الموبايل (بالمقدمة الدولية مثلا 00970)', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'video', label: 'رابط الفيديو', type: 'url' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'special_hours' }
    ];

    const fieldsLocation = [
        { name: 'gov_a', label: 'اسم المحافظة', type: 'text' },
        { name: 'village_a', label: 'المدينة / القرية', type: 'text' },
        { name: 'location', label: 'اسم المنطقة', type: 'text' }
    ];

    function escapeXml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).replace(/[<>&"']/g, (ch) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
        }[ch]));
    }

    function populatePolygonLayers() {
        if (!layerSelect) return;
        layerSelect.innerHTML = '<option value="">--- اختر الطبقة ---</option>';
        const allowed = { 
            'landLayer': 'طبقة الأراضي للبيع', 
            'locationLayer': 'طبقة المناطق' 
        };
        Object.keys(allowed).forEach(key => {
            if (overlayLayersObj[key]) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = allowed[key];
                layerSelect.appendChild(opt);
            }
        });
    }

    function getLocationData(geometry) {
        const locationLayer = overlayLayersObj['locationLayer'];
        if (!locationLayer) return null;
        const features = locationLayer.getSource().getFeatures();
        for (let f of features) {
            if (f.getGeometry().intersectsExtent(geometry.getExtent())) {
                return {
                    location: f.get('location'),
                    gov_a: f.get('gov_a'),
                    village_a: f.get('village_a')
                };
            }
        }
        return null;
    }

    window.deactivatePolygonEditTools = function() {
        [draw, modify, snap, select].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = null;
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active-tool'));
        if (attributeModal) attributeModal.style.display = 'none';
        map.getTargetElement().style.cursor = '';
        currentFeature = null;
    };

    function setupInteractions(mode) {
        window.deactivatePolygonEditTools();
        selectedLayerKey = layerSelect.value;
        if (!selectedLayerKey) return alert('يرجى اختيار طبقة أولاً');
        
        const layer = overlayLayersObj[selectedLayerKey];
        selectedLayerSource = layer.getSource();

        if (mode === 'add') {
            addFeatureBtn.classList.add('active-tool');
            draw = new ol.interaction.Draw({ source: selectedLayerSource, type: 'Polygon' });
            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                setTimeout(() => showAttributeModal(currentFeature), 300);
            });
            map.addInteraction(draw);
        } else if (mode === 'modify') {
            modifyFeatureBtn.classList.add('active-tool');
            select = new ol.interaction.Select({ layers: [layer], hitTolerance: 10 });
            map.addInteraction(select);
            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                currentFeature = e.selected[0];
                currentTransactionType = 'update';
                modify = new ol.interaction.Modify({ features: select.getFeatures() });
                map.addInteraction(modify);
                showAttributeModal(currentFeature);
            });
        } else if (mode === 'delete') {
            deleteFeatureBtn.classList.add('active-tool');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                if (e.selected.length === 0) return;
                if (confirm('هل أنت متأكد من حذف هذا المضلع نهائياً؟')) sendWFS_T(e.selected[0], 'delete');
                select.getFeatures().clear();
            });
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    function showAttributeModal(feature) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إدخال بيانات مضلع جديد' : 'تحديث البيانات';
        attributeForm.innerHTML = '';
        attributeModal.style.display = 'block';
        const activeFields = (selectedLayerKey === 'landLayer') ? fieldsLand : fieldsLocation;

        activeFields.forEach(f => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            div.style.textAlign = 'right';

            let val = feature.get(f.name) || '';

            if (f.type === 'special_hours') {
                div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:4px;">${f.label}:</label>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="poly_inp_${f.name}" name="${f.name}" value="${val}" placeholder="00:00 - 00:00" style="flex:1; padding:8px;">
                        <button type="button" onclick="document.getElementById('poly_inp_${f.name}').value='متوفر 24 ساعة'" style="padding:5px 10px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer;">24 ساعة</button>
                    </div>`;
            } else {
                if (f.type === 'date' && val) try { val = new Date(val).toISOString().split('T')[0]; } catch(e) {}
                div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:4px;">${f.label}:</label>
                    <input type="${f.type}" name="${f.name}" value="${val}" style="width:100%; padding:8px; border:1px solid #ccc;">`;
            }
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        if (!currentFeature) return;
        const formData = new FormData(attributeForm);
        const featureProps = {}; 
        const activeFields = (selectedLayerKey === 'landLayer') ? fieldsLand : fieldsLocation;

        activeFields.forEach(f => {
            let val = formData.get(f.name);
            
            // تعديل الواتساب: تنظيف المسافات فقط وحفظ الرقم كما أدخله المستخدم بالمقدمة
            if (f.name === 'whatsapp' && val) {
                val = val.replace(/\s/g, ''); 
            }
            
            featureProps[f.name] = (f.type === 'number') ? (val === "" ? null : Number(val)) : val;
        });

        if (selectedLayerKey === 'landLayer') {
            const locData = getLocationData(currentFeature.getGeometry());
            if (locData) {
                featureProps['location'] = locData.location;
                featureProps['gov_a'] = locData.gov_a;
                featureProps['village_a'] = locData.village_a;
            }
            
            if (currentTransactionType === 'insert') {
                featureProps['start_date'] = new Date().toISOString().split('T')[0];
            }
            featureProps['status'] = 0;
            
            if (featureProps['end_date']) {
                const today = new Date();
                const endDate = new Date(featureProps['end_date']);
                featureProps['auto_status'] = (endDate < today) ? 1 : 0;
            } else {
                featureProps['auto_status'] = 0;
            }
        }

        currentFeature.setProperties(featureProps);
        attributeModal.style.display = 'none';
        
        sendWFS_T(currentFeature, currentTransactionType);
    }

    function sendWFS_T(feature, type) {
        const workspace = 'realestate';
        const typeName = (selectedLayerKey === 'landLayer') ? 'LandSale' : 'Location';
        const featureNS = "http://localhost:8080/geoserver/realestate";
        const fullQualifiedName = `${workspace}:${typeName}`;

        let rawId = feature.getId() || feature.get('fid') || feature.get('id');
        let cleanId = (rawId && String(rawId).includes('.')) ? rawId.split('.').pop() : rawId;
        const fidValue = cleanId ? `${typeName}.${cleanId}` : "";

        const geom = feature.getGeometry();
        const buildPolygonGML = (polygon) => {
            let rings = polygon.getCoordinates();
            let gmlRings = rings.map((ring, index) => {
                if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) ring.push(ring[0]);
                let coords = ring.map(c => `${c[0]},${c[1]}`).join(' ');
                let ringTag = (index === 0) ? 'gml:exterior' : 'gml:interior';
                return `<${ringTag}><gml:LinearRing><gml:coordinates decimal="." cs="," ts=" ">${coords}</gml:coordinates></gml:LinearRing></${ringTag}>`;
            }).join('');
            return `<gml:Polygon srsName="EPSG:28191">${gmlRings}</gml:Polygon>`;
        };

        let gmlGeometry = (geom.getType() === 'MultiPolygon') 
            ? `<gml:MultiPolygon srsName="EPSG:28191">${geom.getPolygons().map(p => `<gml:polygonMember>${buildPolygonGML(p)}</gml:polygonMember>`).join('')}</gml:MultiPolygon>`
            : buildPolygonGML(geom);

        let payload = '';
        const props = Object.assign({}, feature.getProperties());
        
        delete props['geometry']; 
        delete props['objectid'];
        delete props['id'];
        delete props['fid'];
        delete props['boundedBy'];

        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
            fieldsXML += `<${workspace}:geom>${gmlGeometry}</${workspace}:geom>`;
            for (let k in props) {
                if (props[k] !== undefined && props[k] !== null && props[k] !== "") {
                    fieldsXML += `<${workspace}:${k}>${escapeXml(props[k])}</${workspace}:${k}>`;
                }
            }
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } else if (type === 'update') {
            if (!fidValue) return alert("خطأ: لم يتم التعرف على معرف العنصر");
            let propsXML = '';
            for (let k in props) {
                if (props[k] !== undefined && props[k] !== null) {
                    propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(props[k])}</wfs:Value></wfs:Property>`;
                }
            }
            propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value>${gmlGeometry}</wfs:Value></wfs:Property>`;
            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } else if (type === 'delete') {
            if (!fidValue) return alert("خطأ: المعرف غير موجود");
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `<?xml version="1.0" encoding="UTF-8"?>
            <wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:${workspace}="${featureNS}">
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
                window.deactivatePolygonEditTools();
            } else {
                console.error("GeoServer Error:", text);
                alert('فشل في السيرفر: راجع مخرجات الكونسول.');
            }
        }).catch(err => alert('خطأ في الاتصال بالسيرفر.'));
    }

    populatePolygonLayers();
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => {
        if(currentTransactionType === 'insert' && currentFeature) selectedLayerSource.removeFeature(currentFeature);
        window.deactivatePolygonEditTools();
    };
    layerSelect.onchange = () => window.deactivatePolygonEditTools();
}