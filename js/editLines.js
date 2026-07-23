/**
 * editLines.js - 
 */
window.initializeLineEditTools = function (map, overlayLayersObj) {
    let draw, modify, snap, select;
    let currentFeature;
    let currentTransactionType;
    let originalFeatureId;

    const targetSRS      = 'EPSG:28191';
    const workspace      = 'realestate';
    const typeName       = 'RoadsTest';
    const featureNS      = 'http://localhost/realestate';
    const roadsLayerKey  = 'roadsLayer';

    // الحقول المتطابقة مع Schema جدول RoadsTest
    const editableFields = [
        { name: 'name',      label: 'اسم الطريق',         type: 'text'   },
        { name: 'road_type', label: 'نوع الطريق',         type: 'number' },
        { name: 'one_way',   label: 'اتجاه السير (0=كلا / 1=باتجاه)', type: 'number' }
    ];

    // ترتيب الحقول متطابق مع Schema الجيوسيرفر
    const insertSchemaOrder = [
        'geom', 'name', 'road_type', 'village_a', 'one_way',
        'source', 'target', 'cost', 'gov_a'
    ];

    const updateAllowedProps = [
        'name', 'road_type', 'one_way', 'source', 'target', 'cost', 'gov_a', 'village_a'
    ];

    const addFeatureBtn    = document.getElementById('line-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('line-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('line-delete-feature-btn');
    const attributeModal   = document.getElementById('lineAttributeModal');
    const attributeForm    = document.getElementById('lineAttributeForm');
    const submitBtn        = document.getElementById('lineSubmitAttributes');
    const cancelBtn        = document.getElementById('lineCancelAttributes');

    // 🆕 escapeXml أصبحت معرّفة مرة واحدة فقط بملف shared-utils.js (window.escapeXml)
    const escapeXml = window.escapeXml;

    function getSource() {
        return overlayLayersObj[roadsLayerKey]?.getSource();
    }

    // جلب البيانات الإقليمية من طبقة المناطق
    function getRegionalData(coord) {
        const loc = overlayLayersObj['locationLayer'];
        if (!loc) return { gov_a: 'غير محدد', village_a: 'غير محدد' };
        const pt = Array.isArray(coord[0]) ? coord[0] : coord;
        for (let f of loc.getSource().getFeatures()) {
            if (f.getGeometry().intersectsCoordinate(pt)) {
                return {
                    gov_a:     f.get('gov_a')     || 'غير محدد',
                    village_a: f.get('village_a') || 'غير محدد'
                };
            }
        }
        return { gov_a: 'غير محدد', village_a: 'غير محدد' };
    }

    // بناء GML للـ MultiLineString
    function buildMultiLineStringGML(geom) {
        let coords;
        if (geom.getType() === 'MultiLineString') {
            coords = geom.getCoordinates();
        } else {
            // LineString عادي - نلفه في MultiLineString
            coords = [geom.getCoordinates()];
        }
        let members = coords.map(line => {
            const pts = line.map(c => `${c[0]} ${c[1]}`).join(' ');
            return `<gml:lineStringMember><gml:LineString srsName="${targetSRS}"><gml:posList>${pts}</gml:posList></gml:LineString></gml:lineStringMember>`;
        }).join('');
        return `<gml:MultiLineString srsName="${targetSRS}">${members}</gml:MultiLineString>`;
    }

    window.deactivateLineEditTools = function () {
        [draw, modify, snap, select].forEach(i => i && map.removeInteraction(i));
        draw = modify = snap = select = null;
        originalFeatureId = null;
        currentFeature = null;
        map.getTargetElement().style.cursor = '';
        if (attributeModal) attributeModal.style.display = 'none';
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(b => b?.classList.remove('active-tool'));
    };

    function setupInteractions(mode) {
        window.deactivateLineEditTools();
        const source = getSource();
        if (!source) return alert('خطأ: طبقة الطرق غير محملة');
        const layer = overlayLayersObj[roadsLayerKey];

        if (mode === 'add') {
            addFeatureBtn?.classList.add('active-tool');
            map.getTargetElement().style.cursor = 'crosshair';
            draw = new ol.interaction.Draw({ source, type: 'LineString' });
            draw.on('drawend', e => {
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
            select.on('select', e => {
                if (!e.selected.length) return;
                currentFeature = e.selected[0];
                currentTransactionType = 'update';
                originalFeatureId = currentFeature.getId();
                modify = new ol.interaction.Modify({ features: select.getFeatures() });
                map.addInteraction(modify);
                map.getTargetElement().style.cursor = 'copy';
                showAttributeModal(currentFeature);
            });

        } else if (mode === 'delete') {
            deleteFeatureBtn?.classList.add('active-tool');
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', e => {
                if (!e.selected.length) return;
                if (confirm('🗑️ هل أنت متأكد من حذف هذا الطريق؟')) {
                    sendWFS_T(e.selected[0], 'delete');
                }
                select.getFeatures().clear();
            });
        }

        snap = new ol.interaction.Snap({ source });
        map.addInteraction(snap);
    }

    function showAttributeModal(feature) {
        if (!attributeForm || !attributeModal) return;
        attributeForm.innerHTML = '';

        // تنسيق المودال
        Object.assign(attributeModal.style, {
            display: 'block', position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            maxHeight: '85vh', overflowY: 'auto',
            width: '420px', maxWidth: '95%',
            backgroundColor: '#fff', padding: '20px',
            borderRadius: '8px', zIndex: '10001',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)'
        });

        editableFields.forEach(f => {
            const div = document.createElement('div');
            div.style.marginBottom = '12px';
            const label = document.createElement('label');
            label.textContent = f.label;
            label.style.cssText = 'display:block; font-weight:bold; margin-bottom:4px;';
            const input = document.createElement('input');
            input.name = f.name;
            input.type = f.type;
            input.style.cssText = 'width:100%; padding:8px; box-sizing:border-box; border:1px solid #ccc; border-radius:4px;';
            const val = feature.get(f.name);
            input.value = (val !== undefined && val !== null) ? val : '';
            div.appendChild(label);
            div.appendChild(input);
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        if (!currentFeature) return;
        const formData = new FormData(attributeForm);
        const props = {};

        formData.forEach((value, key) => {
            if (key === 'name') {
                props[key] = value.trim() || 'طريق جديد';
            } else {
                props[key] = (value === '' || value === null) ? 0 : parseInt(value);
            }
        });

        // جلب البيانات الإقليمية من أول نقطة في الخط
        const firstCoord = currentFeature.getGeometry().getFirstCoordinate();
        const regional = getRegionalData(firstCoord);
        props['gov_a']     = regional.gov_a;
        props['village_a'] = regional.village_a;

        if (currentTransactionType === 'insert') {
            props['source'] = 0;
            props['target'] = 0;
            props['cost']   = 0.0;
        }

        currentFeature.setProperties(props);
        if (attributeModal) attributeModal.style.display = 'none';
        sendWFS_T(currentFeature, currentTransactionType);
    }

    async function sendWFS_T(feature, type) {
        const source           = getSource();
        const fullQualifiedName = `${workspace}:${typeName}`;

        // الحصول على الـ FID
        let rawId   = originalFeatureId || feature.getId() || feature.get('id');
        let cleanId = (rawId && String(rawId).includes('.')) ? String(rawId).split('.').pop() : rawId;
        const fidValue = cleanId ? `${typeName}.${cleanId}` : '';

        // بناء الهندسة MultiLineString
        const geom       = feature.getGeometry().clone();
        const gmlGeometry = buildMultiLineStringGML(geom);

        const props = Object.assign({}, feature.getProperties());
        ['geometry', 'geom', 'id', 'fid', 'objectid', 'boundedBy', 'id_0', 'layer'].forEach(k => delete props[k]);

        let payload = '';

        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
            fieldsXML += `<${workspace}:geom>${gmlGeometry}</${workspace}:geom>`;

            // تعبئة القيم الافتراضية للحقول الإلزامية
            if (!props['gov_a']) props['gov_a'] = 'غير محدد';
            if (!props['village_a']) props['village_a'] = 'غير محدد';
            if (!props['source']) props['source'] = 0;
            if (!props['target']) props['target'] = 0;
            if (!props['cost']) props['cost'] = 0.0;
            if (!props['road_type']) props['road_type'] = 0;
            if (!props['one_way']) props['one_way'] = 0;

            insertSchemaOrder.forEach(k => {
                if (k === 'geom') return; // تم إضافته أعلاه
                const val = props[k];
                if (val === undefined || val === null || String(val).trim() === '') return;
                fieldsXML += `<${workspace}:${k}>${escapeXml(val)}</${workspace}:${k}>`;
            });

            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;

            console.log('[Line Insert] Payload:', payload);

        } else if (type === 'update') {
            if (!fidValue) {
                alert('❌ خطأ: لم يتم العثور على معرف الطريق للتحديث');
                return;
            }
            let propsXML = '';
            updateAllowedProps.forEach(k => {
                const val = props[k];
                if (val === undefined || val === null || String(val).trim() === '') return;
                propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(val)}</wfs:Value></wfs:Property>`;
            });
            propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value>${gmlGeometry}</wfs:Value></wfs:Property>`;
            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;

        } else if (type === 'delete') {
            if (!fidValue) {
                alert('❌ خطأ: لا يمكن الحذف بدون معرف الطريق');
                return;
            }
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
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

        console.log("📤 WFS-T Lines Request:", requestXML);

        // طلب بيانات التوثيق من المشرف
        const { value: usernameInput } = await Swal.fire({
            title: '🔑 حساب المسؤول',
            text: 'أدخل اسم مستخدم جيوسيرفر:',
            input: 'text',
            inputValue: '',
            showCancelButton: true,
            confirmButtonText: 'التالي ➔',
            cancelButtonText: 'إلغاء',
            allowOutsideClick: false,
            inputAttributes: { autocomplete: 'off' },
            inputValidator: v => (!v || !v.trim()) ? 'اسم المستخدم مطلوب!' : null
        });
        if (!usernameInput) { window.deactivateLineEditTools(); return; }

        const { value: passwordInput } = await Swal.fire({
            title: '🔒 كلمة المرور',
            text: `كلمة مرور (${usernameInput}):`,
            input: 'password',
            inputAttributes: { autocomplete: 'new-password' },
            showCancelButton: true,
            confirmButtonText: 'حفظ ✔',
            cancelButtonText: 'إلغاء',
            allowOutsideClick: false,
            inputValidator: v => (!v || !v.trim()) ? 'كلمة المرور مطلوبة!' : null
        });
        if (!passwordInput) { window.deactivateLineEditTools(); return; }

        const token = btoa(`${usernameInput}:${passwordInput}`);

        Swal.fire({
            title: 'جاري الحفظ...',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading()
        });

        const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
            ? '/geoserver-proxy/wfs'
            : '/geoserver-proxy/wfs';

        fetch(baseUrl, {
            method: 'POST',
            body: requestXML,
            headers: {
                'Content-Type': 'text/xml',
                'Authorization': `Basic ${token}`
            }
        }).then(async res => {
            const text = await res.text();
            if (res.ok && !text.includes('Exception')) {
                Swal.fire({ icon: 'success', title: 'تمت العملية بنجاح!', confirmButtonText: 'موافق' });
                if (source) source.refresh();
                window.deactivateLineEditTools();
            } else {
                console.error("GeoServer Lines Error:", text);
                const match = text.match(/<ows:ExceptionText>(.*?)<\/ows:ExceptionText>/s);
                Swal.fire({
                    icon: 'error',
                    title: 'فشلت العملية',
                    text: match ? match[1] : 'خطأ غير معروف - راجع الكونسول',
                    confirmButtonText: 'موافق'
                });
                window.deactivateLineEditTools();
            }
        }).catch(err => {
            console.error("Network Error:", err);
            Swal.fire({ icon: 'error', title: 'خطأ في الاتصال', text: err.message });
            window.deactivateLineEditTools();
        });
    }

    // ربط الأزرار
    if (addFeatureBtn)    addFeatureBtn.onclick    = () => setupInteractions('add');
    if (modifyFeatureBtn) modifyFeatureBtn.onclick  = () => setupInteractions('modify');
    if (deleteFeatureBtn) deleteFeatureBtn.onclick  = () => setupInteractions('delete');
    if (submitBtn)        submitBtn.onclick         = submitAttributes;
    if (cancelBtn)        cancelBtn.onclick         = () => {
        if (currentTransactionType === 'insert' && currentFeature) getSource()?.removeFeature(currentFeature);
        window.deactivateLineEditTools();
    };
};