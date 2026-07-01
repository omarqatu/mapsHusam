/**
 * editPolygons.js - النسخة الهندسية المتقدمة والمحدثة 2026 لترابط واجهات المضلعات
 * مطابقة تماماً لمنهجية حماية حقول الجيوسيرفر، التوثيق الآمن، وحل مشكلة انهيار إحداثيات المضلع.
 */
function initializePolygonEditTools(map, overlayLayersObj) {
    let draw, modify, snap, select, reshapeDraw;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    let selectedLayerKey;
    let featureProperties = {};

    // ربط عناصر واجهة المستخدم (DOM Elements)
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

    // قاموس الكلمات الدلالية الثابتة للمضلعات
    const polygonSpecificTags = {
        'landLayer': 'أرض للبيع، أراضي، كوشان، طابو، سكن، زراعي، تجاري، نمرة أرض، استثمار عقاري، مساحات، عقارات للبيع',
        'locationLayer': 'منطقة، حدود بلدية، أحياء، مخطط توجيهي، قسيمة، حوض، تقسيم إداري'
    };

    // مصفوفات الحقول المتطابقة مع قاعدة البيانات الجغرافية
    const fieldsLand = [
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'des', label: 'وصف العقار', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'area', label: 'المساحة (م٢)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الواتساب مع المقدمة (مثلاً 00970...)', type: 'text' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' },
        { name: 'rating', label: 'الرتبة (0-5)', type: 'number' }
    ];

    const fieldsLocation = [
        { name: 'gov_a', label: 'اسم المحافظة', type: 'text' },
        { name: 'village_a', label: 'المدينة / القرية', type: 'text' },
        { name: 'location', label: 'اسم المنطقة', type: 'text' }
    ];

    // دالة حماية الـ XML داخل النطاق المحلي لمنع التضارب
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
        if (geomToolsSub) geomToolsSub.style.display = 'none';
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
        if (!selectedLayerKey) {
            Swal.fire({ icon: 'warning', title: 'تنبيه', text: 'يرجى اختيار طبقة مضلعات أولاً لبدء العمل الهندسي.' });
            return;
        }
        
        const layer = overlayLayersObj[selectedLayerKey];
        selectedLayerSource = layer.getSource();
        toggleDoubleClickZoom(false); 

        if (mode === 'add') {
            if (addFeatureBtn) addFeatureBtn.classList.add('active');
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
                    Swal.fire({
                        title: 'هل أنت متأكد؟',
                        text: "لن تتمكن من استعادة هذا المضلع الجغرافي بعد الحذف النهائي!",
                        icon: 'warning',
                        showCancelButton: true,
                        confirmButtonColor: '#d33',
                        cancelButtonColor: '#3085d6',
                        confirmButtonText: 'نعم، احذفه الآن',
                        cancelButtonText: 'إلغاء'
                    }).then((result) => {
                        if (result.isConfirmed) {
                            sendWFS_T(currentFeature, 'delete');
                        }
                        select.getFeatures().clear();
                        window.deactivatePolygonEditTools();
                    });
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
        if (!modalTitle || !attributeForm || !attributeModal) return;
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة معلم مضلع جديد' : 'تعديل بيانات المضلع';
        attributeForm.innerHTML = '';
        attributeModal.style.display = 'block';
        
        // ضبط التنسيق الهيكلي للنافذة المنبثقة لضمان الانسيابية
        attributeModal.style.position = 'fixed';
        attributeModal.style.top = '50%';
        attributeModal.style.left = '50%';
        attributeModal.style.transform = 'translate(-50%, -50%)';
        attributeModal.style.maxHeight = '85vh';
        attributeModal.style.overflowY = 'auto';
        attributeModal.style.width = '450px';
        attributeModal.style.maxWidth = '95%';
        attributeModal.style.zIndex = '10001';
        attributeModal.style.backgroundColor = '#fff';
        attributeModal.style.padding = '20px';
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
                                <button type="button" id="btn_poly_24h" style="cursor:pointer; padding: 0 10px;">24 ساعة</button>
                             </div>`;
            } else if (f.type === 'date') {
                inputHTML = `<input type="date" name="${f.name}" value="${val}" style="width:100%; padding:8px; box-sizing:border-box;">`;
            } else if (f.type === 'number') {
                inputHTML = `<input type="number" name="${f.name}" value="${val}" step="any" style="width:100%; padding:8px; box-sizing:border-box;">`;
            } else {
                let align = (f.name === 'whatsapp') ? 'ltr' : 'rtl';
                inputHTML = `<input type="text" name="${f.name}" value="${val}" style="width:100%; padding:8px; box-sizing:border-box; direction:${align};">`;
            }

            div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:4px;">${f.label}:</label>${inputHTML}`;
            attributeForm.appendChild(div);

            if (f.type === 'hours') {
                const btn24h = document.getElementById('btn_poly_24h');
                if (btn24h) {
                    btn24h.onclick = () => {
                        const inp = document.getElementById(`poly_inp_${f.name}`);
                        if (inp) inp.value = 'متوفر 24 ساعة';
                    };
                }
            }
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

        // search_tags فقط لطبقة الأراضي - جدول Location لا يحتوي هذا الحقل
        if (selectedLayerKey === 'landLayer') {
            const serviceArabicName = 'أرض للبيع';
            const staticTags = polygonSpecificTags['landLayer'] || '';
            const description = featureProperties['des'] || '';
            let tagsResult = [serviceArabicName, (description || "").trim().substring(0, 40)].map(s => s.trim()).filter(s => s.length > 0).join('، ');
            if (staticTags) tagsResult += `، ${staticTags}`;
            featureProperties['search_tags'] = tagsResult;
        }

        if (currentTransactionType === 'insert') {
            // هذه الحقول فقط لطبقة الأراضي وليس المناطق
            if (selectedLayerKey === 'landLayer') {
                featureProperties['start_date'] = new Date().toISOString().split('T')[0];
                featureProperties['status'] = 0;
                featureProperties['auto_status'] = 0;
            }
        }

        currentFeature.setProperties(featureProperties);
        activateGeometryEditPhase();
    }

    function activateGeometryEditPhase() {
        if (attributeModal) attributeModal.style.display = 'none';
        if (geomToolsSub) geomToolsSub.style.display = 'block';
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
            Swal.fire('تم تشكيل الخط', 'يمكنك تحريك العقد الناتجة لتعديل حدود المضلع بدقة الآن.', 'info');
            startModifyPoints();
        });
    }

    function startReplace() {
        if (modify) map.removeInteraction(modify);
        if (reshapeDraw) map.removeInteraction(reshapeDraw);
        if (draw) map.removeInteraction(draw);

        const oldProps = currentFeature.getProperties();
        const oldFid = currentFeature.getId(); // حفظ FID القديم
        selectedLayerSource.removeFeature(currentFeature);

        draw = new ol.interaction.Draw({ type: 'Polygon' });
        map.addInteraction(draw);

        draw.on('drawend', (e) => {
            currentFeature = e.feature;
            currentFeature.setProperties(oldProps);
            currentFeature.setId(oldFid); // استعادة FID للمعلم الجديد
            selectedLayerSource.addFeature(currentFeature);
            map.removeInteraction(draw);
            Swal.fire('تم استبدال المضلع', 'تم إسقاط الشكل الجديد بنجاح، يرجى مراجعة العقد قبل الضغط على حفظ نهائي.', 'info');
            startModifyPoints();
        });
    }

    function addSnap() {
        if (snap) map.removeInteraction(snap);
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    function submitFinalData() {
        sendWFS_T(currentFeature, currentTransactionType);
    }

    async function sendWFS_T(feature, type) {
        // فحص بيئة العمل وتحديد Workspace بناءً على الطبقة المختارة
        // كلا الطبقتين (LandSale و Location) في قاعدة realestate
        const isRealEstate = (selectedLayerKey === 'landLayer'); // للتمييز بين حقول الطبقتين
        const workspace = 'realestate'; // كلاهما في نفس الـ workspace
        const typeName = isRealEstate ? 'LandSale' : 'Location';
        const featureNS = 'http://localhost/realestate';
        const fullQualifiedName = `${workspace}:${typeName}`;

        let rawId = feature.getId() || feature.get('fid') || feature.get('id');
        let cleanId = (rawId && String(rawId).includes('.')) ? rawId.split('.').pop() : rawId;
        const fidValue = cleanId ? `${typeName}.${cleanId}` : "";

        console.log(`[Polygon Edit] Feature ID extraction: rawId=${rawId}, cleanId=${cleanId}, fidValue=${fidValue}, typeName=${typeName}`);

        const geom = feature.getGeometry();
        
        // 🛠️ الحل الحاسم: استخراج نقطة داخلية (Centroid/Interior Point) للمضلع لحساب الإحداثيات الإقليمية بدون انهيار برمي
        // استخراج نقطة مركزية - نأخذ [x,y] فقط لأن getInteriorPoint ترجع [x,y,z]
        let centroidCoords;
        if (geom.getType() === 'Polygon') {
            const pt = geom.getInteriorPoint().getCoordinates();
            centroidCoords = [pt[0], pt[1]];
        } else if (geom.getType() === 'MultiPolygon') {
            const pt = geom.getPolygon(0).getInteriorPoint().getCoordinates();
            centroidCoords = [pt[0], pt[1]];
        } else {
            centroidCoords = ol.extent.getCenter(geom.getExtent());
        }

        // بناء الـ GML الهيكلي للمضلعات والتحقق من إغلاق الحلقة الهندسية
        // دالة بناء Polygon GML واحد
        const buildSinglePolygonGML = (polygon) => {
            let rings = polygon.getCoordinates();
            let gmlRings = rings.map((ring, index) => {
                if (ring[0][0] !== ring[ring.length-1][0] || ring[0][1] !== ring[ring.length-1][1]) {
                    ring.push(ring[0]);
                }
                let coords = ring.map(c => `${c[0]},${c[1]}`).join(' ');
                let ringTag = (index === 0) ? 'gml:exterior' : 'gml:interior';
                return `<${ringTag}><gml:LinearRing><gml:coordinates decimal="." cs="," ts=" ">${coords}</gml:coordinates></gml:LinearRing></${ringTag}>`;
            }).join('');
            return `<gml:Polygon srsName="EPSG:28191">${gmlRings}</gml:Polygon>`;
        };

        // locationLayer نوع الهندسة MultiPolygon - landLayer نوع الهندسة Polygon
        let gmlGeometry;
        if (!isRealEstate) {
            // locationLayer: يجب إرسال MultiPolygon
            let polygonGML;
            if (geom.getType() === 'MultiPolygon') {
                // المضلع بالفعل MultiPolygon - نبنيه مباشرة
                polygonGML = geom.getPolygons().map(p => buildSinglePolygonGML(p)).join('');
            } else {
                // المضلع Polygon عادي - نلفه في MultiPolygon
                polygonGML = buildSinglePolygonGML(geom);
            }
            gmlGeometry = `<gml:MultiPolygon srsName="EPSG:28191"><gml:polygonMember>${polygonGML}</gml:polygonMember></gml:MultiPolygon>`;
        } else {
            // landLayer: Polygon عادي
            gmlGeometry = buildSinglePolygonGML(geom);
        }
        let payload = '';
        
        // تجميع الحقول والبيانات والتحقق من الترتيب المتسلسل للـ Schema لجيوسيرفر
        let allValuesMap = Object.assign({}, feature.getProperties());
        delete allValuesMap['geometry']; 
        delete allValuesMap['boundedBy'];

        // أتمتة جلب البيانات الجغرافية الإقليمية بالتداخل من طبقة Location (فقط في حال كانت الطبقة المحررة هي الأراضي)
        let regionalData = { gov_a: 'غير محدد', village_a: 'غير محدد', location: 'غير محدد' };
        if (isRealEstate && overlayLayersObj['locationLayer']) {
            const locationLayer = overlayLayersObj['locationLayer'];
            const locationFeatures = locationLayer.getSource().getFeatures();
            for (let f of locationFeatures) {
                if (f.getGeometry().intersectsCoordinate(centroidCoords)) {
                    regionalData.gov_a = f.get('gov_a') || 'غير محدد';
                    regionalData.village_a = f.get('village_a') || 'غير محدد';
                    regionalData.location = f.get('location') || 'غير محدد';
                    break;
                }
            }
        }

        // حساب الإحداثيات المسقطة والعالمية للنقطة المركزية للمضلع (للبيانات الإقليمية فقط)
        const coordsGlobal = ol.proj.toLonLat(centroidCoords, 'EPSG:28191');

        if (type === 'insert') {
            // لا نرسل fid - قاعدة البيانات تولده تلقائياً عبر الـ Sequence
            delete allValuesMap['fid'];

            if (isRealEstate) {
                // للأراضي: خذ من regionalData كـ auto-fill
                allValuesMap['location'] = allValuesMap['location'] || regionalData.location;
                allValuesMap['gov_a'] = allValuesMap['gov_a'] || regionalData.gov_a;
                allValuesMap['village_a'] = allValuesMap['village_a'] || regionalData.village_a;
            } else {
                // للمناطق: خذ من النموذج أولاً ثم regionalData كـ fallback
                allValuesMap['gov_a'] = allValuesMap['gov_a'] || regionalData.gov_a;
                allValuesMap['village_a'] = allValuesMap['village_a'] || regionalData.village_a;
                allValuesMap['location'] = allValuesMap['location'] || regionalData.location;
            }

            // الالتزام التام بالترتيب الهيكلي الصارم لطبقات المضلعات بداخل الجيوسيرفر (بدون حقول الإحداثيات)
            const landSchemaOrder = [
                'geom', 'location', 'price', 'des', 'pic', 'area',
                'status', 'gov_a', 'village_a',
                'start_date', 'end_date', 'work_hours',
                'auto_status', 'whatsapp', 'search_tags', 'rating'
            ];

            const locationSchemaOrder = [
                'geom', 'gov_a', 'village_a', 'location'
            ];

            const finalOrder = isRealEstate ? landSchemaOrder : locationSchemaOrder;

            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
            finalOrder.forEach(k => {
                if (k === 'geom') {
                    fieldsXML += `<${workspace}:geom>${gmlGeometry}</${workspace}:geom>`;
                } else {
                    let val = allValuesMap[k];
                    if (val === undefined || val === null || String(val).trim() === "") {
                        if (k === 'rating') val = 5;
                        else if (k === 'price' || k === 'area') val = 0;
                        else if (k === 'status' || k === 'auto_status') val = 0;
                        else return; // تخطي الحقول الفارغة الأخرى غير الإلزامية
                    }
                    if (k === 'rating') val = Number(val).toFixed(1);
                    fieldsXML += `<${workspace}:${k}>${escapeXml(val)}</${workspace}:${k}>`;
                }
            });
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            if (!fidValue) {
                Swal.fire({ icon: 'error', title: 'خطأ حرج', text: 'لم يتم العثور على معرف المعلم (FID) لتحديث المضلع بالسيرفر.' });
                return;
            }
            let propsXML = '';
            const allowedPropsUpdate = isRealEstate ? 
                ['price', 'des', 'pic', 'area', 'end_date', 'work_hours', 'whatsapp', 'rating', 'search_tags'] :
                ['gov_a', 'village_a', 'location'];

            allowedPropsUpdate.forEach(k => {
                if (allValuesMap[k] !== undefined && allValuesMap[k] !== null && String(allValuesMap[k]).trim() !== "") {
                    let val = allValuesMap[k];
                    if (k === 'rating') val = Number(val).toFixed(1);
                    propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(val)}</wfs:Value></wfs:Property>`;
                }
            });
            
            // حقن التحديثات الهندسية للمضلع فقط (بدون حقول الإحداثيات)
            propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value>${gmlGeometry}</wfs:Value></wfs:Property>`;

            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } 
        else if (type === 'delete') {
            if (!fidValue) {
                Swal.fire({ icon: 'error', title: 'خطأ حرج', text: 'لا يمكن حذف المضلع بدون وجود Feature ID.' });
                return;
            }
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `<?xml version="1.0" encoding="UTF-8"?>
            <wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:${workspace}="${featureNS}" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
                ${payload}
            </wfs:Transaction>`;

        // استخدام البروكسي المحلي على localhost، و GeoServer مباشر على الدومين
        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? '/geoserver-proxy/wfs'
            : '/geoserver-proxy/wfs';

        console.log("📤 Sending Polygon WFS-T Request:", requestXML);

        // 🔑 المرحلة الأولى: طلب اسم المستخدم مع تثبيت "Husam" كقيمة افتراضية مسبقة
        const { value: usernameInput } = await Swal.fire({
            title: '🔑 حساب المسؤول',
            text: 'يرجى تأكيد اسم مستخدم جيوسيرفر المعتمد للتعديل الصارم للمضلعات:',
            input: 'text',
            inputValue: '', 
            showCancelButton: true,
            confirmButtonText: 'التالي ➔',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            allowOutsideClick: false,
            inputAttributes: { 'autocomplete': 'off' },
            inputValidator: (value) => {
                if (!value || value.trim() === "") return 'اسم المستخدم حقل إلزامي!';
            }
        });

        if (!usernameInput) {
            Swal.fire('تم إلغاء المعاملة', 'تم إيقاف الرفع لعدم تقديم حساب التوثيق.', 'info');
            window.deactivatePolygonEditTools();
            return;
        }
        
        // 🔒 المرحلة الثانية: طلب كلمة المرور مع إجبار الحقل على البقاء فارغاً تماماً لمنع النجوم التلقائية القديمة
        const { value: passwordInput } = await Swal.fire({
            title: '🔒 كلمة المرور',
            text: `الرجاء كتابة كلمة المرور للمسؤول (${usernameInput}):`,
            input: 'password', 
            inputAttributes: { 'autocomplete': 'new-password' }, // منع ذكاء المتصفح من تعبئة نجوم خاطئة
            showCancelButton: true,
            confirmButtonText: 'تأكيد وحفظ المضلع هندسياً ✔',
            cancelButtonText: 'إلغاء',
            confirmButtonColor: '#28a745',
            cancelButtonColor: '#d33',
            allowOutsideClick: false,
            inputValidator: (value) => {
                if (!value || value.trim() === "") return 'حقل كلمة المرور مطلوب وجوباً!';
            }
        });

        if (!passwordInput) {
            Swal.fire('تم إلغاء المعاملة', 'تم إيقاف الرفع الجغرافي لعدم كتابة كلمة المرور.', 'info');
            window.deactivatePolygonEditTools();
            return;
        }

        const token = btoa(`${usernameInput}:${passwordInput}`);

        Swal.fire({
            title: 'جاري تحديث الخريطة والمضلعات...',
            text: 'يتم الآن معالجة الحلقات الهندسية والمزامنة مع خادم قاعدة البيانات.',
            allowOutsideClick: false,
            didOpen: () => { Swal.showLoading(); }
        });

        fetch(baseUrl, {
            method: 'POST',
            body: requestXML,
            headers: {
                'Content-Type': 'text/xml',
                'Authorization': `Basic ${token}`
            }
        }).then(async res => {
            const text = await res.text();
            if (res.ok && !text.includes('Exception') && !text.includes('XpathException')) {
                Swal.fire({
                    icon: 'success',
                    title: 'تمت العملية بنجاح!',
                    text: 'تم حفظ وتحديث المضلع الهندسي وجدول البيانات بنجاح تام.',
                    confirmButtonText: 'موافق'
                });
                if (selectedLayerSource && typeof selectedLayerSource.refresh === 'function') {
                    selectedLayerSource.refresh(); 
                }
                window.deactivatePolygonEditTools();
            } else {
                console.error("GeoServer Polygon Response Error Exception:", text);
                Swal.fire({
                    icon: 'error',
                    title: 'فشل معالجة المضلع بالسيرفر',
                    text: 'الجيوسيرفر رفض هيكلية المعاملة، يرجى فحص ترتيب الـ XML والـ Sequence في الكونسول.',
                    confirmButtonText: 'موافق'
                });
                window.deactivatePolygonEditTools();
            }
        }).catch(err => {
            console.error("Fetch Connection error for Polygons:", err);
            Swal.fire({
                icon: 'error',
                title: 'خطأ اتصال بالشبكة',
                text: 'فشل الوصول إلى سيرفر الخرائط، تأكد من إعدادات البروكسي والـ Proxy Routing.',
                confirmButtonText: 'موافق'
            });
            window.deactivatePolygonEditTools();
        });
    }

    // ربط الأحداث وعمليات الضغط على الأزرار
    populatePolygonLayers();
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if(toolModifyPoints) toolModifyPoints.onclick = startModifyPoints;
    if(toolReshape) toolReshape.onclick = startReshape;
    if(toolReplace) toolReplace.onclick = startReplace;
    if(finalSaveBtn) finalSaveBtn.onclick = submitFinalData;

    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => {
        if(currentTransactionType === 'insert' && currentFeature && selectedLayerSource) {
            selectedLayerSource.removeFeature(currentFeature);
        }
        window.deactivatePolygonEditTools();
    };
    if(layerSelect) layerSelect.onchange = () => window.deactivatePolygonEditTools();
}
