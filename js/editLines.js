window.initializeLineEditTools = function (map, overlayLayersObj, enableAllDefaultInteractions, disableSpecificInteractions) {
    // إعدادات عامة
    const selectedLayerName = 'roadsLayer';
    const geometryAttrName = 'geom';
    const targetSRS = 'EPSG:28191';
    const featurePrefix = 'realestate';
    const featureNS = 'http://localhost:8080/geoserver/realestate';
    const geoServerFeatureType = 'RoadsTest';

    // المتغيرات
    let draw = null, modify = null, snap = null, select = null;
    let currentFeature = null;
    let currentTransactionType = null;
    let pointerMoveListener = null;

    // 🛠️ دالة مساعدة لإنشاء معرّف فريد عالمي (UUID)
    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    // تعريف الحقول
    const attributeLabels = {
        name: 'الاسم',
        road_type: 'نوع الطريق',
        village_a: 'المدينة',
        one_way: 'الاتجاه',
        source: 'عقدة البداية',
        target: 'عقدة النهاية',
        cost: 'الكلفة'
    };
    // 🛠️ تم نقل 'road_type' إلى fieldsInt
    const fieldsText = ['name', 'village_a'];
    const fieldsInt = ['road_type', 'one_way', 'source', 'target'];
    const fieldsFloat = ['cost'];
    const allFields = [...fieldsText, ...fieldsInt, ...fieldsFloat];

    // جلب الطبقة والمصدر
    const layer = overlayLayersObj ? overlayLayersObj[selectedLayerName] : null;
    if (!layer) {
        window.deactivateLineEditTools = function () {};
        console.error(`❌ الطبقة ${selectedLayerName} غير موجودة!`);
        return;
    }
    const selectedLayerSource = layer.getSource ? layer.getSource() : null;
    if (!selectedLayerSource) {
        window.deactivateLineEditTools = function () {};
        console.error(`❌ مصدر الطبقة ${selectedLayerName} غير موجود!`);
        return;
    }

    // عناصر الواجهة (تم حذفها للاختصار، افترض وجودها)
    const addFeatureBtn = document.getElementById('line-add-feature-btn');
    const modifyFeatureBtn = document.getElementById('line-modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('line-delete-feature-btn');
    const cancelEditBtn = document.getElementById('line-cancel-edit-btn');
    const attributeModal = document.getElementById('lineAttributeModal');
    const attributeForm = document.getElementById('lineAttributeForm');
    const modalTitle = document.getElementById('lineModalTitle');
    const submitAttributesBtn = document.getElementById('lineSubmitAttributes');
    const cancelAttributesBtn = document.getElementById('lineCancelAttributes');
    const closeAttrModalBtn = document.getElementById('close-line-attribute-modal');

    // Tooltip (تم حذفه للاختصار)
    let helpTooltipElement = null;
    let helpTooltipOverlay = null;

    // =================================== Tooltip Handlers (Unchanged) ===================================
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
        if (helpTooltipOverlay) {
            map.removeOverlay(helpTooltipOverlay);
            helpTooltipOverlay = null;
        }
        if (helpTooltipElement && helpTooltipElement.parentNode) {
            helpTooltipElement.parentNode.removeChild(helpTooltipElement);
        }
        helpTooltipElement = null;
    }

    // =================================== Interaction Control (Unchanged) ===================================
    function disableAllEditInteractions() {
        if (draw) { map.removeInteraction(draw); draw = null; }
        if (modify) { map.removeInteraction(modify); modify = null; }
        if (snap) { map.removeInteraction(snap); snap = null; }
        if (select) { map.removeInteraction(select); select = null; }
        if (pointerMoveListener) {
            map.un('pointermove', pointerMoveListener);
            pointerMoveListener = null;
        }
        destroyHelpTooltip();
    }

    function deactivateLineEditTools() {
        disableAllEditInteractions();
        enableAllDefaultInteractions();
        if (cancelEditBtn) cancelEditBtn.style.display = 'none';
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
        if (attributeModal) attributeModal.style.display = 'none';
        currentFeature = null;
        currentTransactionType = null;
    }
    window.deactivateLineEditTools = deactivateLineEditTools;

    function ensureFeatureId(feature) {
        const fid = feature.getId && feature.getId();
        // نتحقق من وجود ID حقيقي (ليس ID مؤقت من طرف العميل)
        if (fid && typeof fid === 'string' && fid.trim() !== '' && !fid.startsWith('client_temp_')) return true;

        const idProp = feature.get ? feature.get('id') : null;
        // نتحقق من idProp إذا كان موجوداً، ونضمن أنه ليس قيمة نصية '0' أو فارغة
        if (idProp !== undefined && idProp !== null && String(idProp).trim() !== '' && String(idProp).trim() !== '0') {
            const idNum = String(idProp).trim();
            // GeoServer FID format
            const composed = featurePrefix + '.' + geoServerFeatureType + '.' + idNum; 
            feature.setId(composed);
            return true;
        }
        return false;
    }

    /**
     * تعيين الخصائص الافتراضية
     * **تم التأكد من عدم تعيين خاصية 'id' هنا**
     */
    function setDefaultZeroPropsIfInsert(feature) {
        if (!feature) return;
        
        // 🛠️ القيم الافتراضية المناسبة لكل نوع بيانات
        const defaults = {
            name: '0',
            road_type: 0,
            village_a: '0',
            one_way: 0,
            source: 0,
            target: 0,
            cost: 0.1
        };
        
        Object.keys(defaults).forEach(key => {
            const currentValue = feature.get(key);
            // نستخدم القيمة الافتراضية فقط إذا كانت القيمة الحالية غير موجودة (undefined أو null)
            if (currentValue === undefined || currentValue === null) {
                feature.set(key, defaults[key]);
            }
        });
        
        // 🛠️ إضافة معرّف فريد مؤقت (UUID) للميزة الجديدة في طرف العميل (يجب أن يتم عبر setId وليس set('id'))
        if (feature.getId() === undefined || feature.getId() === null) {
            feature.setId('client_temp_' + generateUUID());
        }
    }

    // =================================== Setup Interactions ===================================
    function setupInteractions(mode) {
        disableAllEditInteractions();
        createHelpTooltip();

        if (mode === 'add') {
            draw = new ol.interaction.Draw({
                source: selectedLayerSource,
                // 💡 التعديل: إذا كنت متأكداً أن الطبقة يجب أن تكون MultiLineString، يمكنك تغيير هذا إلى 'MultiLineString'
                // ولكن 'LineString' أفضل للرسم التفاعلي البسيط وسيقوم GeoServer بتحويله إلى MultiLineString
                type: 'MultiLineString', 
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: 'rgba(0, 136, 255, 1)', width: 3, lineDash: [5, 5] })
                })
            });

            draw.on('drawend', function (event) {
                currentFeature = event.feature;
                currentTransactionType = 'insert';

                // نستخدم setDefaultZeroPropsIfInsert لتعيين القيم الافتراضية وإضافة UUID
                setDefaultZeroPropsIfInsert(currentFeature);

                if (pointerMoveListener) {
                    map.un('pointermove', pointerMoveListener);
                    pointerMoveListener = null;
                }
                destroyHelpTooltip();

                map.removeInteraction(draw);
                draw = null;

                showAttributeModal(currentFeature);
            });

            map.addInteraction(draw);

            pointerMoveListener = map.on('pointermove', function (event) {
                updateHelpTooltip(event.coordinate, 'انقر لإضافة النقاط، انقر نقرتين للإنهاء');
            });

        } else if (mode === 'modify') {
            select = new ol.interaction.Select({
                layers: [layer],
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: 'rgba(255, 215, 0, 1)', width: 4 })
                })
            });
            map.addInteraction(select);

            select.on('select', function (event) {
                const features = event.target.getFeatures().getArray();
                if (!features.length) return;

                currentFeature = features[0];
                // 💡 في التعديل يجب أن يكون هناك ID حقيقي (وليس مؤقت)
                if (!ensureFeatureId(currentFeature)) { 
                    alert('فشل: المعلم المحدد ليس له معرف فريد صالح (id).');
                    select.getFeatures().clear();
                    currentFeature = null;
                    return;
                }

                if (pointerMoveListener) {
                    map.un('pointermove', pointerMoveListener);
                    pointerMoveListener = null;
                }
                createHelpTooltip();
                updateHelpTooltip(map.getView().getCenter(), 'اسحب العقد لتعديل الخط، انقر نقرتين للإنهاء');

                modify = new ol.interaction.Modify({
                    features: select.getFeatures(),
                    style: new ol.style.Style({
                        stroke: new ol.style.Stroke({ color: 'rgba(255, 100, 0, 1)', width: 3, lineDash: [5, 5] })
                    })
                });
                map.addInteraction(modify);

                modify.on('modifyend', function (modifyEvent) {
                    const modifiedFeature = modifyEvent.features.item(0);
                    if (modifiedFeature) {
                        currentFeature = modifiedFeature;
                        currentTransactionType = 'update';

                        destroyHelpTooltip();

                        map.removeInteraction(modify);
                        modify = null;
                        map.removeInteraction(select);
                        select = null;

                        showAttributeModal(currentFeature);
                    }
                });
            });

            pointerMoveListener = map.on('pointermove', function (event) {
                updateHelpTooltip(event.coordinate, 'اختر خطاً للتعديل');
            });

        } else if (mode === 'delete') {
            select = new ol.interaction.Select({
                layers: [layer],
                style: new ol.style.Style({
                    stroke: new ol.style.Stroke({ color: 'rgba(255, 0, 0, 1)', width: 4 })
                })
            });
            map.addInteraction(select);

            select.on('select', function (event) {
                currentFeature = event.target.getFeatures().getArray()[0];
                if (!currentFeature) return;

                if (!ensureFeatureId(currentFeature)) {
                    alert('فشل الحذف: المعلم المحدد ليس له معرف فريد صالح (id).');
                    select.getFeatures().clear();
                    currentFeature = null;
                    return;
                }

                currentTransactionType = 'delete';

                destroyHelpTooltip();

                map.removeInteraction(select);
                select = null;

                if (confirm('هل أنت متأكد من حذف هذا الخط؟')) {
                    sendWFS_T(currentFeature, currentTransactionType);
                } else {
                    deactivateLineEditTools();
                }
            });

            pointerMoveListener = map.on('pointermove', function (event) {
                updateHelpTooltip(event.coordinate, 'اختر خطاً لحذفه');
            });
        }

        // Snap
        snap = new ol.interaction.Snap({ source: selectedLayerSource });
        map.addInteraction(snap);

        // تعطيل بعض تفاعلات الخريطة أثناء التحرير
        disableSpecificInteractions(['DragPan', 'DoubleClickZoom', 'PinchZoom', 'KeyboardPan', 'KeyboardZoom', 'DragRotateAndZoom']);
    }

    // =================================== Attribute Modal (Unchanged) ===================================
    function showAttributeModal(feature) {
        if (!attributeModal || !attributeForm || !modalTitle) return;

        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة طريق جديد' : 'تعديل بيانات الطريق';
        attributeForm.innerHTML = '';

        // Helper: قراءة القيمة أو 0 افتراضياً
        const getVal = (fld) => {
            const v = feature.get ? feature.get(fld) : undefined;
            // نستخدم القيمة الافتراضية '0' للنصوص و 0 للأرقام، ونحولها إلى نص للعرض في input
            if (fieldsText.includes(fld)) {
                return (v === undefined || v === null || v === '') ? '0' : String(v);
            } else { // fieldsInt, fieldsFloat
                // نضمن أن أي قيمة غير محددة أو null يتم اعتبارها '0' للعرض في حقل الإدخال
                if (v === undefined || v === null) return '0';
                const num = Number(v);
                return isNaN(num) ? '0' : String(num); // نرجع القيمة كرقم في حال تم تخزينها كنص
            }
        };

        // 🛠️ حقول النصوص: name, village_a
        fieldsText.forEach(field => {
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ':';
            const input = document.createElement('input');
            input.type = 'text';
            input.name = field;
            input.value = getVal(field);
            attributeForm.appendChild(label);
            attributeForm.appendChild(input);
        });

        // 🛠️ road_type (int - number)
        {
            const field = 'road_type';
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ':';
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '1';
            input.name = field;
            input.value = getVal(field);
            attributeForm.appendChild(label);
            attributeForm.appendChild(input);
        }

        // one_way: 0/1/2 (select)
        {
            const field = 'one_way';
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ' (0/1/2):';
            const selectEl = document.createElement('select');
            selectEl.name = field;
            const current = getVal(field);
            ['0', '1', '2'].forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                // نستخدم مقارنة صارمة للقيمة التي تم جلبها من getVal (وهي سترجع قيمة نصية '0')
                if (current === v) opt.selected = true; 
                selectEl.appendChild(opt);
            });
            attributeForm.appendChild(label);
            attributeForm.appendChild(selectEl);
        }

        // source, target (int - number)
        ['source', 'target'].forEach(field => {
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ':';
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '1';
            input.name = field;
            input.value = getVal(field);
            attributeForm.appendChild(label);
            attributeForm.appendChild(input);
        });

        // cost (float - number)
        {
            const field = 'cost';
            const label = document.createElement('label');
            label.textContent = attributeLabels[field] + ':';
            const input = document.createElement('input');
            input.type = 'number';
            input.step = '0.01';
            input.name = field;
            input.value = getVal(field);
            attributeForm.appendChild(label);
            attributeForm.appendChild(input);
        }

        attributeModal.style.display = 'block';
        if (cancelEditBtn) cancelEditBtn.style.display = 'block';
    }

    // =================================== Cancel & Remove Feature (Unchanged) ===================================
    function safeRemoveDrawnFeature() {
        try {
            if (currentTransactionType === 'insert' && currentFeature && selectedLayerSource) {
                // نضمن الإزالة فقط إذا كان لديه FID مؤقت للعميل ولم يتم إرساله
                if (String(currentFeature.getId() || '').startsWith('client_temp_')) {
                    const g = currentFeature.getGeometry && currentFeature.getGeometry();
                    if (g) selectedLayerSource.removeFeature(currentFeature);
                }
            }
        } catch (e) { }
    }

    function cancelAttributes() {
        safeRemoveDrawnFeature();
        if (attributeModal) attributeModal.style.display = 'none';
        deactivateLineEditTools();
    }

    // =================================== 🟢 التعديل الرئيسي هنا: بناء الميزة لـ WFS-T 🟢 ===================================
    /**
     * بناء Feature نظيف لعمليات WFS-T.
     * **تم التأكد من عدم إرسال ID في حالة INSERT.**
     */
    function buildCleanFeatureForWFS(srcFeature, transactionType) {
        // نستخدم ميزة فارغة كلياً لتجنب أي خصائص غير مرغوب فيها
        const f = new ol.Feature(); 
        
        // ننسخ فقط الخصائص التي نحتاجها لإرسالها في الـ WFS-T
        srcFeature.getKeys().forEach(p => {
            // لا نرسل خصائص الـ ID أو الـ geometry_name كخصائص بيانات
            if (allFields.includes(p)) {
                const value = srcFeature.get(p);
                // 🛠️ تأكد من عدم إرسال NULL/undefined لـ GeoServer
                // تم تحويل القيم إلى أصفار افتراضية مسبقاً في submitAttributes
                if (value !== null && value !== undefined) {
                    f.set(p, value);
                }
            }
        });

        // الهندسة وتحويل SRS
        const viewSRS = map.getView().getProjection().getCode();
        const g = srcFeature.getGeometry && srcFeature.getGeometry();
        const gCloned = g ? g.clone() : null;
        if (gCloned) {
            if (viewSRS !== targetSRS) gCloned.transform(viewSRS, targetSRS);
            f.setGeometryName(geometryAttrName);
            f.setGeometry(gCloned);

            // 🚨 التعديل الرئيسي لمعالجة MultiLineString/LineString 
            // إذا كانت الهندسة LineString (التي ترسمها) وأنت ترسل إلى MultiLineString
            // فـ ol.format.WFS يتعامل معها بشكل صحيح في الغالب.
            // لفرض تحويل LineString إلى MultiLineString في طرف العميل قبل الإرسال (اختياري ولكنه أدق):
            // if (gCloned.getType() === 'LineString') {
            //     f.setGeometry(new ol.geom.MultiLineString([gCloned.getCoordinates()]));
            // }
        }

        // 🚨 التعديل لحل مشكلة الـ ID المتكرر في الإدراج:
        // عند التعديل/الحذف نحدد المعرّف (ID)
        if (transactionType !== 'insert' && ensureFeatureId(srcFeature)) {
            f.setId(srcFeature.getId());
        } else if (transactionType === 'insert') {
            // عند الإدراج، نضمن أن الـ ID (FID) الخاص بميزة ol.Feature غير معرّف ليقوم ol.format.WFS بتجاهله،
            // مما يسمح لـ GeoServer بتعيين ID جديد من الـ sequence.
            f.setId(undefined);
        }

        return f;
    }

    // =================================== WFS-T Send (Unchanged) ===================================
    function parseWFSError(xmlDoc, rawBody) {
        const exceptionReport = xmlDoc.getElementsByTagName('ows:ExceptionReport')[0] ||
                               xmlDoc.getElementsByTagName('ExceptionReport')[0] ||
                               xmlDoc.getElementsByTagName('ServiceExceptionReport')[0];
        if (!exceptionReport) return null;

        const exceptionText = xmlDoc.getElementsByTagName('ows:ExceptionText')[0] ||
                               xmlDoc.getElementsByTagName('ExceptionText')[0] ||
                               xmlDoc.getElementsByTagName('ServiceException')[0];
        return exceptionText ? exceptionText.textContent.trim() : (rawBody || 'WFS-T error');
    }

    function sendWFS_T(feature, transactionType) {
        if (!feature) {
            deactivateLineEditTools();
            return Promise.reject(new Error('No feature specified.'));
        }

        // 💡 ملاحظة: يجب التأكد من تحميل مكتبات GML و WFS لـ OpenLayers
        const gmlFormat = new ol.format.GML({
            featureNS: featureNS,
            featurePrefix: featurePrefix,
            featureType: geoServerFeatureType,
            srsName: targetSRS,
            geometryName: geometryAttrName
        });
        const wfsFormat = new ol.format.WFS();

        let inserts = null, updates = null, deletes = null;
        const cleanFeature = buildCleanFeatureForWFS(feature, transactionType);

        if (transactionType === 'insert') {
            inserts = [cleanFeature];
        } else if (transactionType === 'update') {
            if (!ensureFeatureId(feature)) {
                alert('فشل في التعديل: لا يوجد معرف صالح (id).');
                return Promise.reject(new Error('Missing valid Feature ID.'));
            }
            updates = [cleanFeature];
        } else if (transactionType === 'delete') {
            if (!ensureFeatureId(feature)) {
                alert('فشل في الحذف: لا يوجد معرف صالح (id).');
                return Promise.reject(new Error('Missing valid Feature ID.'));
            }
            deletes = [cleanFeature];
        }

        const node = wfsFormat.writeTransaction(inserts, updates, deletes, gmlFormat);
        const payload = new XMLSerializer().serializeToString(node);

        const loadingMsg = document.createElement('div');
        loadingMsg.id = 'loading-road-msg';
        loadingMsg.textContent = '⏳ جاري إرسال العملية...';
        loadingMsg.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(0,0,0,0.8);color:white;padding:20px;border-radius:10px;z-index:10000;font-size:18px;';
        document.body.appendChild(loadingMsg);

        return fetch('/proxy/geoserver/wfs', {
            method: 'POST',
            headers: { 'Content-Type': 'text/xml; charset=UTF-8' },
            body: payload
        })
        .then(resp => resp.text().then(text => ({ status: resp.status, body: text })))
        .then(({ body }) => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(body, 'text/xml');

            const err = parseWFSError(xmlDoc, body);
            if (err) {
                alert('❌ فشلت العملية:\n' + err);
                if (transactionType === 'insert') safeRemoveDrawnFeature();
                return Promise.reject(new Error(err));
            }

            // التحقق من النجاح
            const inserted = xmlDoc.getElementsByTagName('wfs:totalInserted')[0] || xmlDoc.getElementsByTagName('totalInserted')[0];
            const updated = xmlDoc.getElementsByTagName('wfs:totalUpdated')[0] || xmlDoc.getElementsByTagName('totalUpdated')[0];
            const deleted = xmlDoc.getElementsByTagName('wfs:totalDeleted')[0] || xmlDoc.getElementsByTagName('totalDeleted')[0];

            let success = false;
            if (transactionType === 'insert' && inserted && parseInt(inserted.textContent || '0', 10) >= 1) success = true;
            if (transactionType === 'update' && updated && parseInt(updated.textContent || '0', 10) >= 1) success = true;
            if (transactionType === 'delete' && deleted && parseInt(deleted.textContent || '0', 10) >= 1) success = true;
            
            if (!success) {
                alert('❌ فشلت العملية. (الخادم لم يؤكد الإدراج/التحديث/الحذف).');
                if (transactionType === 'insert') safeRemoveDrawnFeature();
                return Promise.reject(new Error('Transaction failed confirmation.'));
            }

            // 💡 تحديث المصدر لجلب الميزة الجديدة ذات الـ ID الحقيقي
            setTimeout(() => selectedLayerSource.refresh(), 400); 
            alert('✅ تمت العملية بنجاح!');
        })
        .catch(error => {
            alert('❌ خطأ في الإرسال/الاتصال: ' + error.message);
            if (transactionType === 'insert') safeRemoveDrawnFeature();
            throw error;
        })
        .finally(() => {
            const msg = document.getElementById('loading-road-msg');
            if (msg) document.body.removeChild(msg);
            deactivateLineEditTools();
        });
    }


    // =================================== 🟢 التعديل الرئيسي الثاني: معالجة بيانات الإرسال 🟢 ===================================
    /**
     * معالجة بيانات النموذج وتحديث الـ Feature وإرساله لـ WFS-T.
     * **تم تحسين التحويل للأرقام والأصفار.**
     */
    async function submitAttributes() {
        if (!attributeForm || !currentFeature || !currentTransactionType) {
            alert('حدث خطأ: لا توجد عملية أو ميزة محددة للحفظ.');
            deactivateLineEditTools();
            return;
        }

        const geom = currentFeature.getGeometry && currentFeature.getGeometry();
        if (!geom) {
            alert('خطأ: لم يتم العثور على هندسة للخط. يرجى إعادة الرسم.');
            safeRemoveDrawnFeature();
            deactivateLineEditTools();
            return;
        }

        const formData = new FormData(attributeForm);
        const props = {};

        // نجمع كل الخصائص من النموذج ونحولها إلى نوع البيانات المناسب
        for (const [key, value] of formData.entries()) {
            if (fieldsInt.includes(key)) {
                // 🛠️ تحويل إلى رقم صحيح مع التأكد من القيمة الافتراضية 0
                const v = parseInt(value, 10);
                props[key] = isNaN(v) ? 0 : v;
            } else if (fieldsFloat.includes(key)) {
                // 🛠️ تحويل إلى رقم عشري مع التأكد من القيمة الافتراضية 0.0
                const v = parseFloat(value);
                props[key] = isNaN(v) ? 0.0 : v; 
            } else if (fieldsText.includes(key)) {
                // 🛠️ التأكد من أن قيمة النص ليست فارغة
                const v = (value === undefined || value === null || String(value).trim() === '') ? '0' : String(value).trim();
                // التأكد من أن طول النص لا يتجاوز الحد (حسب الصورة 300 و 255)
                if (key === 'name' && v.length > 300) {
                     alert(`تجاوز الحد الأقصى لحقل ${attributeLabels.name} (300 حرف).`);
                     return;
                }
                 if (key === 'village_a' && v.length > 255) {
                     alert(`تجاوز الحد الأقصى لحقل ${attributeLabels.village_a} (255 حرف).`);
                     return;
                }
                props[key] = v;
            }
        }

        // نضمن أن جميع الحقول مدرجة في الـ Feature قبل الإرسال (هذا يحل مشكلة NULL)
        allFields.forEach(fld => {
            if (!(fld in props)) {
                const existingVal = currentFeature.get(fld);
                // إذا كانت القيمة موجودة بالفعل في الـ Feature نستخدمها، وإلا نستخدم القيمة الافتراضية
                if (existingVal !== undefined && existingVal !== null) {
                    // 💡 يجب تحويل القيمة الموجودة لـ *نوع البيانات المطلوب* إذا كانت من نوع غير صحيح
                    if (fieldsInt.includes(fld)) {
                        props[fld] = parseInt(existingVal, 10) || 0;
                    } else if (fieldsFloat.includes(fld)) {
                        props[fld] = parseFloat(existingVal) || 0.0;
                    } else { // fieldsText
                        props[fld] = String(existingVal);
                    }
                } else {
                    // القيمة الافتراضية إذا كانت غير موجودة مطلقاً
                    props[fld] = fieldsText.includes(fld) ? '0' : 0;
                }
            }
        });

        // نحدث الـ Feature مؤقتاً بالخصائص الجديدة
        Object.keys(props).forEach(key => {
            currentFeature.set(key, props[key]);
        });


        try {
            // نرسل الـ Feature (والذي يحمل الآن الخصائص المحدثة)
            await sendWFS_T(currentFeature, currentTransactionType);
            if (attributeModal) attributeModal.style.display = 'none';
        } catch (e) {
            // يتم التعامل مع الأخطاء في sendWFS_T
        }
    }


    // =================================== Bind UI (Unchanged) ===================================
    if (addFeatureBtn) addFeatureBtn.addEventListener('click', () => {
        if (attributeModal) attributeModal.style.display = 'none';
        setupInteractions('add');
        addFeatureBtn.classList.add('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
        if (cancelEditBtn) cancelEditBtn.style.display = 'block';
    });

    if (modifyFeatureBtn) modifyFeatureBtn.addEventListener('click', () => {
        if (attributeModal) attributeModal.style.display = 'none';
        setupInteractions('modify');
        modifyFeatureBtn.classList.add('active');
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
        if (cancelEditBtn) cancelEditBtn.style.display = 'block';
    });

    if (deleteFeatureBtn) deleteFeatureBtn.addEventListener('click', () => {
        if (attributeModal) attributeModal.style.display = 'none';
        setupInteractions('delete');
        deleteFeatureBtn.classList.add('active');
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (cancelEditBtn) cancelEditBtn.style.display = 'block';
    });

    if (cancelEditBtn) cancelEditBtn.addEventListener('click', deactivateLineEditTools);
    if (submitAttributesBtn) submitAttributesBtn.addEventListener('click', function (e) {
        e.preventDefault();
        submitAttributes();
    });
    if (cancelAttributesBtn) cancelAttributesBtn.addEventListener('click', function (e) {
        e.preventDefault();
        cancelAttributes();
    });
    if (closeAttrModalBtn) closeAttrModalBtn.addEventListener('click', function (e) {
        e.preventDefault();
        cancelAttributes();
    });

    // حالة البدء
    deactivateLineEditTools();
};