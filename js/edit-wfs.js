/**
 * edit-wfs.js - كود WFS-T لإرسال عمليات الإضافة والتعديل والحذف إلى GeoServer
 * تم التحديث لحل مشاكل مطابقة حقول العقارات على السيرفر الخارجي ومنع التعبئة التلقائية.
 * تم تنظيف الكود من أي تفاصيل تخص أراضي البيع وحذف حقل الـ fid من عمليات الـ Insert.
 */
async function sendWFS_T(feature, type) {
    
    // 🛠️ دالة محلياً داخل النطاق لمنع التضارب وتحويل الرموز الخاصة في XML
    function escapeXml(unsafe) {
        if (unsafe === undefined || unsafe === null) return '';
        return String(unsafe).replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
                default: return c;
            }
        });
    }

    // 🎯 الفحص الديناميكي لضمان دقة التعرف على العقارات (شقق فقط)
    const isRealEstate = (typeof MAP_CONFIG !== 'undefined' && MAP_CONFIG.layers && MAP_CONFIG.layers.realestate)
        ? MAP_CONFIG.layers.realestate.some(l => l.id === selectedLayerName || l.name === selectedLayerName)
        : ['rentLayer', 'saleLayer'].includes(selectedLayerName);

    const workspace = isRealEstate ? 'realestate' : 'services';
    const layer = overlayLayersObj[selectedLayerName];
    
    // ⚠️ روابط الـ Namespace URI المتطابقة مع إعدادات GeoServer حيث تعمل الطبقات الفعلية
    const namespaceUris = {
        services: 'http://localhost/services',
        realestate: 'http://localhost/realestate'
    };
    const featureNS = namespaceUris[workspace] || `http://localhost/${workspace}`;
    
    let typeName = "";
    try {
        if (layer) {
            const source = layer.getSource();
            let url = typeof source.getUrl === 'function' ? source.getUrl() : '';
            if (!url && typeof source.getUrls === 'function') {
                const urls = source.getUrls();
                url = urls ? urls[0] : '';
            }
            
            if (url && url.includes('?')) {
                const urlParams = new URLSearchParams(url.split('?')[1]);
                const fullTypeName = urlParams.get('typeName') || urlParams.get('layers') || urlParams.get('typename');
                if (fullTypeName) {
                    typeName = fullTypeName.includes(':') ? fullTypeName.split(':')[1] : fullTypeName;
                }
            }
        }
    } catch (e) {
        console.warn("فشل استخراج الـ TypeName ديناميكياً، تحويل للافتراضي المعالج:", e);
    }

    // fallback للتأكد من عدم انقطاع التسمية للطبقات المحددة (شقق إيجار / شقق بيع)
    if (!typeName) {
        const layerNameMap = {
            'rentLayer': 'ApartRent',
            'saleLayer': 'ApartSale'
        };
        if (MAP_CONFIG && MAP_CONFIG.layers && MAP_CONFIG.layers.realestate) {
            const directConfig = MAP_CONFIG.layers.realestate.find(l => l.id === selectedLayerName || l.name === selectedLayerName);
            if (directConfig) typeName = directConfig.name;
        }
        typeName = typeName || layerNameMap[selectedLayerName] || selectedLayerName.replace('Layer', '').toLowerCase();
    }

    if (!layer) {
        Swal.fire({
            icon: 'error',
            title: 'خطأ حرج',
            text: 'لم يتم العثور على كائن الطبقة المحددة في النظام.',
            confirmButtonText: 'موافق'
        });
        return;
    }

    const coords = feature.getGeometry().getCoordinates();
    const fullQualifiedName = `${workspace}:${typeName}`;
    const olId = feature.getId();
    const rawIdCandidate = olId || feature.get('fid') || feature.get('id');
    const rawId = rawIdCandidate ? (String(rawIdCandidate).includes('.') ? String(rawIdCandidate).split('.').pop() : rawIdCandidate) : '';
    const fidValue = rawId ? `${typeName}.${rawId}` : "";

    // عزل حقول المدخلات اليدوية لكل بيئة بشكل مستقل ومضمون (شقق عقارات مقابل خدمات نقاط)
    const allowedPropsAdd = isRealEstate ?
        ['price', 'des', 'pic', 'video', 'area', 'whatsapp', 'end_date', 'work_hours', 'rating', 'location'] :
        ['name', 'whatsapp', 'des', 'pic', 'rating', 'details_link_1', 'details_link_2', 'end_date', 'work_hours'];

    // إضافة search_tags وغيرها لضمان تحديثها عند التعديل
    const allowedPropsUpdate = isRealEstate ?
        ['price', 'des', 'pic', 'video', 'area', 'end_date', 'work_hours', 'whatsapp', 'rating', 'location', 'search_tags'] :
        ['name', 'whatsapp', 'pic', 'rating', 'details_link_1', 'details_link_2', 'end_date', 'work_hours', 'des', 'search_tags'];

    let payload = '';
    if (type === 'insert') {
        let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
        const props = feature.getProperties();
        
        let allValuesMap = {};

        // 1. معالجة وتجهيز قيم المدخلات اليدوية والافتراضية
        allowedPropsAdd.forEach(k => {
            let val = props[k];
            if (val === null || val === undefined || String(val).trim() === "") {
                if (k === 'rating') val = 5;
                else if (k === 'price' || k === 'area') val = 0;
                else if (k === 'work_hours') val = 'متوفر 24 ساعة';
                else if (k === 'name') val = 'خدمة جديدة';
                else if (k === 'location') val = 'غير محدد';
                else val = ''; 
            }
            allValuesMap[k] = val;
        });

        // 2. استخراج البيانات الإقليمية من طبقة Location تقاطع هندسي
        let regionalData = { gov_a: 'غير محدد', village_a: 'غير محدد', location: 'غير محدد' };
        if (overlayLayersObj['locationLayer']) {
            const locationLayer = overlayLayersObj['locationLayer'];
            const locationFeatures = locationLayer.getSource().getFeatures();
            for (let f of locationFeatures) {
                if (f.getGeometry().intersectsCoordinate(coords)) {
                    regionalData.gov_a = f.get('gov_a') || 'غير محدد';
                    regionalData.village_a = f.get('village_a') || 'غير محدد';
                    regionalData.location = f.get('location') || 'غير محدد';
                    break;
                }
            }
        }

        // 3. بناء وحساب قيم الـ autoFields التلقائية (تم استبعاد fid تماماً ليتم توليده من قاعدة البيانات)
        const autoFields = isRealEstate ?
            ['status', 'gov_a', 'village_a', 'start_date', 'auto_status', 'search_tags', 'x_coord', 'y_coord', 'X', 'Y'] :
            ['location_name', 'x_coord', 'y_coord', 'x_global', 'y_global', 'status', 'gov_a', 'village_a', 'start_date', 'auto_status', 'search_tags'];

        autoFields.forEach(k => {
            let val = '';
            if (k === 'x_coord' || k === 'y_coord') {
                val = coords[k === 'x_coord' ? 0 : 1].toFixed(2);
            }
            else if (k === 'X' || k === 'Y' || k === 'x_global' || k === 'y_global') {
                const coordsGlobal = ol.proj.toLonLat(coords, 'EPSG:28191');
                const index = (k === 'X' || k === 'x_global') ? 0 : 1;
                val = coordsGlobal[index].toFixed(6);
            }
            else if (k === 'status' || k === 'auto_status') val = 0;
            else if (k === 'start_date') val = new Date().toISOString().split('T')[0];
            else if (k === 'gov_a') val = regionalData.gov_a;
            else if (k === 'village_a') val = regionalData.village_a;
            else if (k === 'location_name') val = 'غير محدد';
            else if (k === 'search_tags') {
                val = props['search_tags'] ? props['search_tags'] : (isRealEstate ? 'عقار' : 'خدمة');
            }
            
            // في حال لم تكن الـ location مدخلة يدوياً يتم أخذها من تقاطع الخريطة
            if (k === 'location' && (!allValuesMap['location'] || allValuesMap['location'] === 'غير محدد')) {
                val = regionalData.location;
            }

            if (val !== '') {
                allValuesMap[k] = val;
            }
        });

        // 🎯 الترتيب الهيكلي المتطابق تماماً مع Schema الجيوسيرفر لجدول الشقق والخدمات (الـ Sequence الصارم)
        const realEstateSchemaOrder = [
            'geom', 'location', 'price', 'des', 'pic', 'video', 'area',
            'x_coord', 'y_coord', 'status', 'gov_a', 'village_a',
            'X', 'Y', 'start_date', 'end_date', 'work_hours',
            'auto_status', 'whatsapp', 'search_tags', 'rating'
        ];

        const servicesSchemaOrder = [
            'geom', 'name', 'whatsapp', 'des', 'pic', 'rating', 'details_link_1', 'details_link_2', 'end_date', 'work_hours',
            'location_name', 'x_coord', 'y_coord', 'x_global', 'y_global', 'status', 'gov_a', 'village_a', 'start_date', 'auto_status', 'search_tags'
        ];

        const finalExecutionOrder = isRealEstate ? realEstateSchemaOrder : servicesSchemaOrder;

        // بناء الـ XML بالترتيب المتسلسل المطلوب هندسياً لقاعدة البيانات
        finalExecutionOrder.forEach(k => {
            if (k === 'geom') {
                fieldsXML += `<${workspace}:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></${workspace}:geom>`;
            } else {
                let val = allValuesMap[k];
                if (val === undefined || val === null || String(val).trim() === "") {
                    return; 
                }
                if (k === 'rating') {
                    val = Number(val).toFixed(1);
                }
                fieldsXML += `<${workspace}:${k}>${escapeXml(val)}</${workspace}:${k}>`;
            }
        });

        fieldsXML += `</${fullQualifiedName}>`;
        payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
    } 
    else if (type === 'update') {
        if (!fidValue) {
            Swal.fire({ icon: 'error', title: 'خطأ حرج', text: 'لم يتم العثور على معرف المعلم (FID) لتحديثه بالسيرفر.' });
            return null;
        }
        let propsXML = '';
        const props = feature.getProperties();
        
        for (let k in props) {
            if (allowedPropsUpdate.includes(k) && props[k] !== undefined && props[k] !== null && String(props[k]).trim() !== "") {
                let val = props[k];
                if (k === 'rating') {
                    val = Number(val).toFixed(1);
                }
                propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(val)}</wfs:Value></wfs:Property>`;
            }
        }
        
        // تحديث الهندسة المكانية للنقطة وإحداثياتها الرقمية والعالمية
        propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></wfs:Value></wfs:Property>`;
        
        const coordsGlobal = ol.proj.toLonLat(coords, 'EPSG:28191');
        propsXML += `<wfs:Property><wfs:Name>${workspace}:x_coord</wfs:Name><wfs:Value>${coords[0].toFixed(2)}</wfs:Value></wfs:Property>`;
        propsXML += `<wfs:Property><wfs:Name>${workspace}:y_coord</wfs:Name><wfs:Value>${coords[1].toFixed(2)}</wfs:Value></wfs:Property>`;
        
        if (isRealEstate) {
            propsXML += `<wfs:Property><wfs:Name>${workspace}:X</wfs:Name><wfs:Value>${coordsGlobal[0].toFixed(6)}</wfs:Value></wfs:Property>`;
            propsXML += `<wfs:Property><wfs:Name>${workspace}:Y</wfs:Name><wfs:Value>${coordsGlobal[1].toFixed(6)}</wfs:Value></wfs:Property>`;
        } else {
            propsXML += `<wfs:Property><wfs:Name>${workspace}:x_global</wfs:Name><wfs:Value>${coordsGlobal[0].toFixed(6)}</wfs:Value></wfs:Property>`;
            propsXML += `<wfs:Property><wfs:Name>${workspace}:y_global</wfs:Name><wfs:Value>${coordsGlobal[1].toFixed(6)}</wfs:Value></wfs:Property>`;
        }
        
        payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
    } 
    else if (type === 'delete') {
        if (!fidValue) {
            Swal.fire({ icon: 'error', title: 'خطأ حرج', text: 'لا يمكن الحذف بدون FID.' });
            return null;
        }
        payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
    }

    const requestXML = `<?xml version="1.0" encoding="UTF-8"?>
        <wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:${workspace}="${featureNS}" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
            ${payload}
        </wfs:Transaction>`;

    const baseUrl = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? '/geoserver-proxy/wfs'
        : '/geoserver-proxy/wfs';

    console.log("📤 Sending WFS-T Request:", requestXML);

    // 🔑 1. نافذة طلب اسم المستخدم للتوثيق الصارم
    const { value: usernameInput } = await Swal.fire({
        title: '🔑 اسم المستخدم',
        text: 'يرجى إدخال اسم مستخدم جيوسيرفر الموثق للتعديل:',
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
            if (!value || value.trim() === "") {
                return 'يجب تزويد اسم المستخدم للمتابعة!';
            }
        }
    });

    if (!usernameInput) {
        Swal.fire('تم الإلغاء', 'تم إلغاء عملية الحفظ لعدم توفير الحساب.', 'info');
        if (typeof deactivatePointEditTools === 'function') deactivatePointEditTools();
        return null;
    }
    
    // 🔒 2. نافذة طلب كلمة المرور (تمنع التعبئة التلقائية تماماً)
    const { value: passwordInput } = await Swal.fire({
        title: '🔒 كلمة المرور',
        text: `الرجاء إدخال كلمة المرور الخاصة بالمستخدم (${usernameInput}):`,
        input: 'password', 
        inputAttributes: { 'autocomplete': 'new-password' },
        showCancelButton: true,
        confirmButtonText: 'تأكيد وحفظ المعلم ✔',
        cancelButtonText: 'إلغاء',
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#d33',
        allowOutsideClick: false,
        inputValidator: (value) => {
            if (!value || value.trim() === "") {
                return 'حقل كلمة المرور مطلوب!';
            }
        }
    });

    if (!passwordInput) {
        Swal.fire('تم الإلغاء', 'تم إلغاء عملية الحفظ لعدم تزويد كلمة المرور.', 'info');
        if (typeof deactivatePointEditTools === 'function') deactivatePointEditTools();
        return null;
    }

    const token = btoa(`${usernameInput}:${passwordInput}`);

    Swal.fire({
        title: 'جاري الحفظ...',
        text: 'يتم الآن إرسال المعاملة الجغرافية والتخزين في قاعدة البيانات.',
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
                title: 'تم الحفظ بنجاح!',
                text: 'تمت العملية وحفظ المعلم بنجاح في قاعدة البيانات الجغرافية.',
                confirmButtonText: 'موافق'
            });

            if (layer && layer.getSource() && typeof layer.getSource().refresh === 'function') {
                layer.getSource().refresh(); 
            }
            if (typeof deactivatePointEditTools === 'function') deactivatePointEditTools();
        } else {
            console.error("GeoServer Response Error Exception:", text);
            Swal.fire({
                icon: 'error',
                title: 'فشل حفظ المعلم بالسيرفر',
                text: 'حدثت مشكلة تعارض حقول أو صلاحيات داخل الجيوسيرفر. تفقد الكونسول لمشاهدة الـ XML Error.',
                confirmButtonText: 'موافق'
            });
            if (typeof deactivatePointEditTools === 'function') deactivatePointEditTools();
        }
    }).catch(err => {
        console.error("Fetch Connection error:", err);
        Swal.fire({
            icon: 'error',
            title: 'خطأ في الاتصال',
            text: 'فشل الاتصال بسيرفر الخرائط الرئيسي، يرجى التحقق من البروكسي أو مسار الوصلة الخارجي.',
            confirmButtonText: 'موافق'
        });
        if (typeof deactivatePointEditTools === 'function') deactivatePointEditTools();
    });
}
