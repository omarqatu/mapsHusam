/**
 * editPolygons.js - نسخة التحرير الهندسي المتقدم المحدثة 2026
 * مطابقة تماماً لهيكل واجهة تحرير النقاط وقواعد معالجة الكلمات الدلالية والأتمتة
 */
function initializePolygonEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select, reshapeDraw;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerKey;
    let featureProperties = {};

    const layerSelect = document.getElementById('polygon-layer-select');
    const addFeatureBtn = document.getElementById('polygon-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('polygon-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('polygon-delete-feature-btn');
    const attributeModal = document.getElementById('polygonAttributeModal');
    const attributeForm = document.getElementById('polygonAttributeForm');
    const modalTitle = document.getElementById('polygonModalTitle');
    const submitAttributesBtn = document.getElementById('polygonSubmitAttributes');
    const cancelAttributesBtn = document.getElementById('polygonCancelAttributes');
    
    const geomToolsSub = document.getElementById('geometry-tools-sub');
    const finalSaveBtn = document.getElementById('polygonFinalSave');
    const toolModifyPoints = document.getElementById('tool-modify-points');
    const toolReshape = document.getElementById('tool-reshape');
    const toolReplace = document.getElementById('tool-replace');

    // قاموس الكلمات الدلالية المخصصة الثابتة للطبقات (مطابق للنقاط والعقارات الشاملة)
    const polygonSpecificTags = {
        'landLayer': 'أرض للبيع، أراضي، كوشان، طابو، سكن، زراعي، تجاري، نمرة أرض، استثمار عقاري، مساحات، عقارات للبيع',
        'locationLayer': 'منطقة، حدود بلدية، أحياء، مخطط توجيهي، قسيمة، حوض، تقسيم إداري'
    };

    // مصفوفة الحقول لطبقة الأراضي (مصممة على نمط حقول شقق البيع والإيجار في موديول النقاط تماماً)
    const fieldsLand = [
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'des', label: 'وصف العقار', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'area', label: 'المساحة (م٢)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الواتساب مع المقدمة (مثلاً 00970...)', type: 'text' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' },
        { name: 'rating', label: 'الرتبة (0-10)', type: 'number' }
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

    function toggleDoubleClickZoom(active) {
        map.getInteractions().forEach(interaction => {
            if (interaction instanceof ol.interaction.DoubleClickZoom) {
                interaction.setActive(active);
            }
        });
    }

    function populatePolygonLayers() {
        if (!layerSelect) return;
        layerSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
        const allowed = { 'landLayer': 'طبقة الأراضي للبيع', 'locationLayer': 'طبقة المناطق' };
        Object.keys(allowed).forEach(key => {
            if (overlayLayersObj[key]) {
                const opt = document.createElement('option');
                opt.value = key;
                opt.textContent = allowed[key];
                layerSelect.appendChild(opt);
            }
        });
    }

    window.deactivatePolygonEditTools = function() {
        [draw, modify, snap, select, reshapeDraw].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = reshapeDraw = null;
        geomToolsSub.style.display = 'none';
        toggleDoubleClickZoom(true); 
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
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
        toggleDoubleClickZoom(false); 

        if (mode === 'add') {
            addFeatureBtn.classList.add('active');
            draw = new ol.interaction.Draw({ source: selectedLayerSource, type: 'Polygon' });
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
                    if (confirm('هل أنت متأكد من حذف هذا المضلع؟')) sendWFS_T(currentFeature, 'delete');
                    select.getFeatures().clear();
                    window.deactivatePolygonEditTools();
                } else {
                    currentTransactionType = 'update';
                    showAttributeModal(currentFeature);
                }
            });
        }
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    // بناء وعرض واجهة الخصائص (نفس نمط واجهة النقاط تماماً مع دعم ميزات حقل الساعات المطور والاتجاهات)
    function showAttributeModal(feature) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة معلم جديد' : 'تعديل البيانات';
        attributeForm.innerHTML = '';
        attributeModal.style.display = 'block';
        // تعديل الاستايل برمجياً لمنع خروج الواجهة عن نطاق الشاشة عند الزووم
        attributeModal.style.position = 'fixed';
        attributeModal.style.top = '50%';
        attributeModal.style.left = '50%';
        attributeModal.style.transform = 'translate(-50%, -50%)';
        attributeModal.style.maxHeight = '85vh';      // حد أقصى لارتفاع النافذة (85% من طول الشاشة)
        attributeModal.style.overflowY = 'auto';       // تفعيل التمرير العمودي (العجل) تلقائياً عند الحاجة
        attributeModal.style.width = '450px';          // عرض ثابت ومناسب للحقول
        attributeModal.style.maxWidth = '95%';         // حماية إضافية متجاوبة للشاشات الصغيرة
        attributeModal.style.zIndex = '10001';         // ضمان ظهورها فوق خريطة OpenLayers والأشرطة الجانبية
        attributeModal.style.backgroundColor = '#fff';
        attributeModal.style.padding = '15px';
        attributeModal.style.borderRadius = '8px';
        attributeModal.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        const activeFields = (selectedLayerKey === 'landLayer') ? fieldsLand : fieldsLocation;

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
                                <input type="text" id="poly_inp_${f.name}" name="${f.name}" value="${val || ''}" placeholder="مثال: 08:00-16:00" style="flex:1; padding:8px;">
                                <button type="button" onclick="document.getElementById('poly_inp_${f.name}').value='متوفر 24 ساعة'" style="cursor:pointer;">24 ساعة</button>
                             </div>`;
            } else if (f.type === 'date') {
                inputHTML = `<input type="date" name="${f.name}" value="${val}" style="width:100%; padding:8px;">`;
            } else if (f.type === 'number') {
                inputHTML = `<input type="number" name="${f.name}" value="${val}" step="any" style="width:100%; padding:8px;">`;
            } else {
                let align = (f.name === 'whatsapp') ? 'ltr' : 'rtl';
                inputHTML = `<input type="text" name="${f.name}" value="${val}" style="width:100%; padding:8px; direction:${align};">`;
            }

            div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:4px;">${f.label}:</label>${inputHTML}`;
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        const formData = new FormData(attributeForm);
        const activeFields = (selectedLayerKey === 'landLayer') ? fieldsLand : fieldsLocation;
        featureProperties = {};

        activeFields.forEach(f => {
            let val = formData.get(f.name);
            if (f.name === 'whatsapp' && val) {
                val = val.toString().trim(); 
            }
            featureProperties[f.name] = (f.type === 'number') ? (val === "" ? null : Number(val)) : val;
        });

        // --- منطقة توليد وحقن الكلمات الدلالية الافتراضية المطور للمضلعات ---
        const serviceArabicName = (selectedLayerKey === 'landLayer') ? 'أرض للبيع' : 'منطقة جغرافية';
        const staticTags = polygonSpecificTags[selectedLayerKey] || '';
        const providerName = ''; // لا يوجد حقل اسم مزود في مضلعات الأراضي
        const description = featureProperties['des'] || '';

        // تفكيك وتجميع الكلمات الدلالية لتفادي الفواصل المزدوجة والفراغات الزائدة
        let tagsResult = [serviceArabicName, providerName, (description || "").trim().substring(0, 40)].map(s => s.trim()).filter(s => s.length > 0).join('، ');
        
        if (staticTags) {
            tagsResult += `، ${staticTags}`;
        }
        featureProperties['search_tags'] = tagsResult;

        // وضع قيم الحالة التلقائية (مطابقة تماماً لقواعد النقاط الاستراتيجية)
        if (currentTransactionType === 'insert') {
            featureProperties['start_date'] = new Date().toISOString().split('T')[0];
            featureProperties['status'] = 0;
            featureProperties['auto_status'] = 0;
        }

        // إسناد الخصائص المؤتمتة للمضلع الحالي قبل تحويله لمرحلة الرسم الهندسي
        currentFeature.setProperties(featureProperties);
        activateGeometryEditPhase();
    }

    function activateGeometryEditPhase() {
        attributeModal.style.display = 'none';
        geomToolsSub.style.display = 'block';
        startModifyPoints();
    }

    function startModifyPoints() {
        if (modify) map.removeInteraction(modify);
        if (reshapeDraw) map.removeInteraction(reshapeDraw);
        if (draw) map.removeInteraction(draw);
        
        modify = new ol.interaction.Modify({ features: new ol.Collection([currentFeature]) });
        map.addInteraction(modify);
        addSnap();
    }

    function startReshape() {
        if (modify) map.removeInteraction(modify);
        if (reshapeDraw) map.removeInteraction(reshapeDraw);
        if (draw) map.removeInteraction(draw);

        reshapeDraw = new ol.interaction.Draw({ type: 'LineString' });
        map.addInteraction(reshapeDraw);
        
        reshapeDraw.on('drawend', (e) => {
            const lineGeom = e.feature.getGeometry();
            const polyGeom = currentFeature.getGeometry();
            alert('تم رسم خط التشكيل بنجاح. يمكنك تحريك العقد الناتجة الآن بدقة.');
            startModifyPoints();
        });
    }

    function startReplace() {
        if (modify) map.removeInteraction(modify);
        if (reshapeDraw) map.removeInteraction(reshapeDraw);
        if (draw) map.removeInteraction(draw);
        
        const oldProps = currentFeature.getProperties();
        selectedLayerSource.removeFeature(currentFeature);
        
        draw = new ol.interaction.Draw({ type: 'Polygon' });
        map.addInteraction(draw);
        
        draw.on('drawend', (e) => {
            currentFeature = e.feature;
            currentFeature.setProperties(oldProps);
            selectedLayerSource.addFeature(currentFeature);
            map.removeInteraction(draw);
            alert('تم استبدال الشكل القديم. راجع النقاط الخارجية جيدا قبل إنهاء الحفظ.');
            startModifyPoints();
        });
    }

    function addSnap() {
        if (snap) map.removeInteraction(snap);
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    function submitFinalData() {
        // حزم كافة البيانات والرفع النهائي الآمن عبر بروتوكول WFS-T للخادم
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

        let gmlGeometry = buildPolygonGML(geom);
        let payload = '';
        const props = Object.assign({}, feature.getProperties());
        delete props['geometry']; delete props['boundedBy'];

        // قائمة الحقول المسموح برفعها وتحديثها لطبقة المضلعات العقارية (بدون x, y النقاط الجغرافية)
        const allowedPropsAdd = ['price', 'des', 'pic', 'area', 'whatsapp', 'end_date', 'work_hours', 'start_date', 'status', 'auto_status', 'rating', 'search_tags', 'gov_a', 'village_a', 'location'];
        const allowedPropsUpdate = ['price', 'des', 'pic', 'area', 'whatsapp', 'end_date', 'work_hours', 'rating', 'search_tags', 'gov_a', 'village_a', 'location'];

        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}"><${workspace}:geom>${gmlGeometry}</${workspace}:geom>`;
            for (let k in props) {
                if (allowedPropsAdd.includes(k) && props[k] !== null && props[k] !== undefined && props[k] !== "") {
                    fieldsXML += `<${workspace}:${k}>${escapeXml(props[k])}</${workspace}:${k}>`;
                }
            }
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } else if (type === 'update') {
            let propsXML = '';
            for (let k in props) {
                if (allowedPropsUpdate.includes(k) && props[k] !== null && props[k] !== undefined) {
                    propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(props[k])}</wfs:Value></wfs:Property>`;
                }
            }
            propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value>${gmlGeometry}</wfs:Value></wfs:Property>`;
            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } else if (type === 'delete') {
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `<?xml version="1.0" encoding="UTF-8"?><wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:ogc="http://www.opengis.net/ogc" xmlns:gml="http://www.opengis.net/gml" xmlns:${workspace}="${featureNS}">${payload}</wfs:Transaction>`;

        fetch('/proxy/geoserver/wfs', { method: 'POST', body: requestXML, headers: { 'Content-Type': 'text/xml' } })
        .then(res => res.text()).then(text => {
            if (text.includes('Exception')) {
                console.error(text);
                alert('حدث خطأ في السيرفر أثناء معالجة مضلعات WFS-T!');
            } else {
                alert('تمت العملية وحفظ الشكل الهندسي مع الكلمات الدلالية والحالة بنجاح!');
                selectedLayerSource.refresh();
                window.deactivatePolygonEditTools();
            }
        }).catch(err => alert('خطأ في الاتصال بالسيرفر للمضلعات'));
    }

    // ربط العناصر ومستمعي الأحداث البرمجية (UI Event Listeners)
    populatePolygonLayers();
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    
    // عند الضغط على زر استمرار داخل واجهة الخصائص، يتم تحويل المستخدم فوراً للمرحلة الهندسية
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    
    if(toolModifyPoints) toolModifyPoints.onclick = startModifyPoints;
    if(toolReshape) toolReshape.onclick = startReshape;
    if(toolReplace) toolReplace.onclick = startReplace;
    if(finalSaveBtn) finalSaveBtn.onclick = submitFinalData;

    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => {
        if(currentTransactionType === 'insert' && currentFeature) selectedLayerSource.removeFeature(currentFeature);
        window.deactivatePolygonEditTools();
    };
    if(layerSelect) layerSelect.onchange = () => window.deactivatePolygonEditTools();
}