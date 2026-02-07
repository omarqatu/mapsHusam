// js/editPolygons.js

/**
 * دالة تهيئة أدوات تحرير المضلعات (الأراضي)
 * متوافقة مع HTML الموحد ومع ملف main.js
 */
function initializePolygonEditTools(map, overlayLayersObj) {
    // 1. المتغيرات والتعريفات الأساسية
    let draw, modify, snap, select;
    let selectedLayerSource;
    let currentFeature = null;
    let currentTransactionType = null;
    const selectedLayerName = 'landLayer'; // اسم الطبقة كما هو في layers.js
    let featureProperties = {};

    // إعدادات GeoServer (تأكد من مطابقتها لإعدادات السيرفر لديك)
    const geometryAttrName = 'geom'; 
    const targetSRS = 'EPSG:28191';  
    const geoServerFeatureType = 'LandSale';
    const featurePrefix = 'realestate';
    const featureNS = 'http://localhost:8080/geoserver/realestate';

    // Tooltip المساعدة
    let helpTooltipElement;
    let helpTooltipOverlay;
    let pointerMoveListener = null;

    // 2. عناصر الواجهة (DOM) من الـ HTML الجديد
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    const editSelect = document.getElementById('edit-layer-select');
    
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    const attributeLabels = {
        'price': 'السعر',
        'des': 'الوصف',
        'area': 'المساحة (م²)',
        'pic': 'رابط الصورة',
        'video': 'رابط الفيديو'
    };

    // الحصول على مصدر الطبقة
    const layer = overlayLayersObj[selectedLayerName];
    if (!layer) {
        console.warn(`⚠️ الطبقة ${selectedLayerName} غير موجودة في الـ overlayLayersObj.`);
        return;
    }
    selectedLayerSource = layer.getSource();

    // ================= الأدوات المساعدة (Tooltips) =================
    function createHelpTooltip() {
        destroyHelpTooltip();
        helpTooltipElement = document.createElement('div');
        helpTooltipElement.className = 'ol-tooltip ol-tooltip-help';
        helpTooltipElement.style.display = 'none';
        helpTooltipOverlay = new ol.Overlay({
            element: helpTooltipElement,
            offset: [15, 0],
            positioning: 'center-left'
        });
        map.addOverlay(helpTooltipOverlay);
    }

    function updateHelpTooltip(coordinate, message) {
        if (helpTooltipElement && helpTooltipOverlay) {
            helpTooltipElement.innerHTML = message;
            helpTooltipOverlay.setPosition(coordinate);
            helpTooltipElement.style.display = 'block';
        }
    }

    function destroyHelpTooltip() {
        if (helpTooltipOverlay) map.removeOverlay(helpTooltipOverlay);
        if (helpTooltipElement && helpTooltipElement.parentNode) helpTooltipElement.parentNode.removeChild(helpTooltipElement);
        helpTooltipElement = null;
        helpTooltipOverlay = null;
    }

    // ================= التحكم بالتفاعلات (Interactions) =================
    function disableAllEditInteractions() {
        if (draw) { map.removeInteraction(draw); draw = null; }
        if (modify) { map.removeInteraction(modify); modify = null; }
        if (snap) { map.removeInteraction(snap); snap = null; }
        if (select) { map.removeInteraction(select); select = null; }
        if (pointerMoveListener) { map.un('pointermove', pointerMoveListener); pointerMoveListener = null; }
        destroyHelpTooltip();
    }

    function deactivatePolygonEditTools() {
        disableAllEditInteractions();
        [addFeatureBtn, modifyFeatureBtn, deleteFeatureBtn].forEach(btn => btn?.classList.remove('active'));
        if (attributeModal) attributeModal.style.display = 'none';
        currentFeature = null;
    }
    window.deactivatePolygonEditTools = deactivatePolygonEditTools;

    function ensureFeatureId(feature) {
        let fid = feature.getId();
        if (!fid || String(fid).startsWith('temp_')) {
            const propFid = feature.get('fid');
            if (propFid) { feature.setId(String(propFid)); return true; }
            return false;
        }
        return true;
    }

    // ================= إعداد الأدوات (Setup) =================
    function setupInteractions(mode) {
        if (editSelect.value !== selectedLayerName) {
            alert("الرجاء اختيار طبقة 'الأراضي' من القائمة أولاً.");
            return;
        }

        disableAllEditInteractions();
        createHelpTooltip();

        if (mode === 'add') {
            draw = new ol.interaction.Draw({
                source: selectedLayerSource,
                type: 'Polygon',
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: '#2196F3', width: 3, lineDash: [5, 5] }),
                    fill: new ol.style.Fill({ color: 'rgba(33, 150, 243, 0.2)' })
                })
            });

            draw.on('drawend', (e) => {
                currentFeature = e.feature;
                currentTransactionType = 'insert';
                disableAllEditInteractions();
                showAttributeModal(currentFeature);
            });
            map.addInteraction(draw);

            pointerMoveListener = map.on('pointermove', (e) => {
                let msg = '🔴 انقر للبدء برسم حدود الأرض';
                if (draw.sketchFeature) {
                    const count = draw.sketchFeature.getGeometry().getCoordinates()[0].length;
                    msg = count > 2 ? '🔴 انقر مرتين للإنهاء' : '🔴 انقر لإضافة زاوية';
                }
                updateHelpTooltip(e.coordinate, msg);
            });

        } else if (mode === 'modify') {
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            
            select.on('select', (e) => {
                const feature = e.target.getFeatures().item(0);
                if (!feature) return;
                if (!ensureFeatureId(feature)) { alert('خطأ: المعلم لا يحتوي على ID'); return; }
                
                currentFeature = feature;
                destroyHelpTooltip();
                modify = new ol.interaction.Modify({ features: select.getFeatures() });
                map.addInteraction(modify);
                
                modify.on('modifyend', () => {
                    currentTransactionType = 'update';
                    showAttributeModal(currentFeature);
                });
            });

            pointerMoveListener = map.on('pointermove', (e) => updateHelpTooltip(e.coordinate, '👆 اختر الأرض لتعديلها'));

        } else if (mode === 'delete') {
            select = new ol.interaction.Select({ layers: [layer] });
            map.addInteraction(select);
            select.on('select', (e) => {
                const feature = e.target.getFeatures().item(0);
                if (feature && confirm('هل أنت متأكد من حذف هذه الأرض؟')) {
                    sendWFS_T(feature, 'delete');
                }
            });
            pointerMoveListener = map.on('pointermove', (e) => updateHelpTooltip(e.coordinate, '🗑️ انقر لحذف الأرض'));
        }

        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);
    }

    // ================= نافذة البيانات (Attributes) =================
    function showAttributeModal(feature) {
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة أرض جديدة' : 'تعديل بيانات الأرض';
        attributeForm.innerHTML = '';

        ['price', 'des', 'area', 'pic', 'video'].forEach(field => {
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ':';
            label.style.display = 'block'; label.style.marginTop = '10px';

            const input = document.createElement('input');
            input.name = field;
            input.type = (field === 'price' || field === 'area') ? 'number' : 'text';
            input.value = feature.get(field) || '';
            input.style.width = '100%'; input.style.padding = '8px';

            attributeForm.appendChild(label);
            attributeForm.appendChild(input);
        });

        attributeModal.style.display = 'block';
    }

    // ================= جلب الموقع تلقائياً =================
    async function getLocationFromGeometry(geometry) {
        try {
            const extent = geometry.getExtent();
            const center = [(extent[0] + extent[2]) / 2, (extent[1] + extent[3]) / 2];
            const wktPoint = `POINT(${center[0]} ${center[1]})`;
            const url = `/proxy/geoserver/wfs?service=WFS&version=1.1.0&request=GetFeature&typeName=realestate:Location&outputFormat=application/json&CQL_FILTER=INTERSECTS(geom,${wktPoint})`;
            
            const resp = await fetch(url);
            const data = await resp.json();
            if (data.features?.length > 0) {
                const p = data.features[0].properties;
                return { location: p.location || '', gov_a: p.gov_a || '', village_a: p.village_a || '' };
            }
        } catch (e) { console.error('Location error:', e); }
        return { location: '', gov_a: '', village_a: '' };
    }

    // ================= تنفيذ العمليات (WFS-T) =================
    async function submitAttributes() {
        const formData = new FormData(attributeForm);
        const props = {};
        formData.forEach((val, key) => props[key] = (key === 'price' || key === 'area') ? parseFloat(val) : val);

        if (!props.price || !props.area) { alert('يرجى ملء السعر والمساحة'); return; }

        submitAttributesBtn.disabled = true;
        submitAttributesBtn.textContent = '⏳ جاري الحفظ...';

        try {
            if (currentTransactionType === 'insert') {
                const loc = await getLocationFromGeometry(currentFeature.getGeometry());
                Object.assign(props, loc, { status: 0 });
            }
            currentFeature.setProperties(props);
            await sendWFS_T(currentFeature, currentTransactionType);
            attributeModal.style.display = 'none';
        } catch (e) {
            alert('حدث خطأ: ' + e.message);
        } finally {
            submitAttributesBtn.disabled = false;
            submitAttributesBtn.textContent = 'حفظ';
        }
    }

    function sendWFS_T(feature, type) {
        const gmlFormat = new ol.format.GML({
            featureNS: featureNS, featurePrefix: featurePrefix, featureType: geoServerFeatureType,
            srsName: targetSRS, geometryName: geometryAttrName
        });
        const wfsFormat = new ol.format.WFS();
        
        const fCloned = feature.clone();
        fCloned.setId(feature.getId());
        fCloned.setGeometryName(geometryAttrName);

        let node;
        if (type === 'insert') node = wfsFormat.writeTransaction([fCloned], null, null, gmlFormat);
        else if (type === 'update') node = wfsFormat.writeTransaction(null, [fCloned], null, gmlFormat);
        else if (type === 'delete') node = wfsFormat.writeTransaction(null, null, [fCloned], gmlFormat);

        const payload = new XMLSerializer().serializeToString(node);

        return fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml' },
            body: payload
        })
        .then(res => res.text())
        .then(text => {
            if (text.includes('Exception')) throw new Error('خطأ من السيرفر');
            selectedLayerSource.refresh();
            alert('✅ تمت العملية بنجاح');
            deactivatePolygonEditTools();
        });
    }

    // ================= ربط الأحداث (Event Listeners) =================
    addFeatureBtn.onclick = () => { setupInteractions('add'); addFeatureBtn.classList.add('active'); };
    modifyFeatureBtn.onclick = () => { setupInteractions('modify'); modifyFeatureBtn.classList.add('active'); };
    deleteFeatureBtn.onclick = () => { setupInteractions('delete'); deleteFeatureBtn.classList.add('active'); };
    
    submitAttributesBtn.onclick = submitAttributes;
    cancelAttributesBtn.onclick = () => {
        if (currentTransactionType === 'insert') selectedLayerSource.removeFeature(currentFeature);
        deactivatePolygonEditTools();
    };
}

// تصدير الدالة للعالم الخارجي
window.initializePolygonEditTools = initializePolygonEditTools;