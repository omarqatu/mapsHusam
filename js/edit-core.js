/**
 * edit-core.js - الكود الأساسي لأدوات تحرير النقاط (UI, interactions, modal)
 */
// متغيرات عالمية للاستخدام في edit-wfs.js
let realEstateLayers, selectedLayerName, overlayLayersObj;
let deactivatePointEditTools, escapeXml;

function initializeEditTools(map, overlayLayersObjParam) {
    overlayLayersObj = overlayLayersObjParam;
    let draw, modify, snap, select;
    let selectedLayerSource;
    let currentFeature;
    let currentTransactionType;
    selectedLayerName = '';
    let featureProperties = {};
    let isWaitingForNewLocation = false;
    let updateTimeoutToken = null;

    realEstateLayers = ['rentLayer', 'saleLayer']; 

    const fieldsRealEstate = [
        { name: 'price', label: 'السعر ($)', type: 'number' },
        { name: 'des', label: 'وصف العقار', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'video', label: 'رابط الفيديو', type: 'url' },
        { name: 'area', label: 'المساحة (م٢)', type: 'number' },
        { name: 'whatsapp', label: 'رقم الواتساب مع المقدمة (مثلاً 00970...)', type: 'text' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' },
        { name: 'rating', label: 'الرتبة (0-10)', type: 'number' }
    ];

    const fieldsServices = [
        { name: 'name', label: 'اسم مزود الخدمة', type: 'text' },
        { name: 'whatsapp', label: 'رقم الواتساب مع المقدمة (مثلاً 00970...)', type: 'text' },
        { name: 'des', label: 'وصف الخدمة والخبرة', type: 'text' },
        { name: 'pic', label: 'رابط الصورة', type: 'url' },
        { name: 'rating', label: 'الرتبة (0-10)', type: 'number' },
        { name: 'details_link_1', label: 'رابط تفاصيل 1', type: 'url' },
        { name: 'details_link_2', label: 'رابط تفاصيل 2', type: 'url' },
        { name: 'end_date', label: 'تاريخ انتهاء الاشتراك', type: 'date' },
        { name: 'work_hours', label: 'ساعات العمل', type: 'hours' }
    ];

    // عناصر الواجهة المستهدفة من الـ HTML
    const editLayerSelect = document.getElementById('edit-layer-select');
    const addFeatureBtn = document.getElementById('add-feature-btn');
    const modifyFeatureBtn = document.getElementById('modify-feature-btn');
    const deleteFeatureBtn = document.getElementById('delete-feature-btn');
    const attributeModal = document.getElementById('attributeModal');
    const attributeForm = document.getElementById('attributeForm');
    const modalTitle = document.getElementById('modalTitle');
    const submitAttributesBtn = document.getElementById('submitAttributes');
    const cancelAttributesBtn = document.getElementById('cancelAttributes');

    escapeXml = function(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe).trim().replace(/[<>&"']/g, (ch) => ({
            '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;'
        }[ch]));
    };

    function populatePointLayers() {
        if (!editLayerSelect) return;
        editLayerSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
        if (!overlayLayersObj) return;

        Object.keys(overlayLayersObj).forEach(key => {
            const layer = overlayLayersObj[key];
            if (!layer || !(layer.getSource() instanceof ol.source.Vector)) return;
            const excluded = ['locationLayer', 'cityLayer', 'landLayer', 'governorateLayer', 'roadsLayer', 'searchMarkerLayer', 'searchResultsHighlightLayer', 'landSaleLayer', 'villagesLayer', 'governoratesLayer', 'areasLayer'];
            if (excluded.includes(key)) return;
            const opt = document.createElement('option');
            opt.value = key;
            opt.textContent = layer.get('title') || key;
            editLayerSelect.appendChild(opt);
        });
    }

    deactivatePointEditTools = function() {
        if (updateTimeoutToken) {
            clearTimeout(updateTimeoutToken);
            updateTimeoutToken = null;
        }

        if (select) {
            select.getFeatures().clear();
            map.removeInteraction(select);
        }
        if (draw) map.removeInteraction(draw);
        if (modify) map.removeInteraction(modify);
        if (snap) map.removeInteraction(snap);
        
        draw = modify = snap = select = null;
        isWaitingForNewLocation = false;
        
        if (addFeatureBtn) addFeatureBtn.classList.remove('active');
        if (modifyFeatureBtn) modifyFeatureBtn.classList.remove('active');
        if (deleteFeatureBtn) deleteFeatureBtn.classList.remove('active');
        if (attributeModal) attributeModal.style.display = 'none';
        map.getTargetElement().style.cursor = '';
        currentFeature = null;
    };

    map.on('singleclick', (evt) => {
        if (isWaitingForNewLocation && currentFeature) {
            if (updateTimeoutToken) clearTimeout(updateTimeoutToken);
            
            const newCoords = evt.coordinate;
            currentFeature.getGeometry().setCoordinates(newCoords);
            isWaitingForNewLocation = false;
            map.getTargetElement().style.cursor = '';
            
            const coordsGlobal = ol.proj.toLonLat(newCoords, 'EPSG:28191');
            const isRealEstate = realEstateLayers.some(layer => selectedLayerName.includes(layer));
            
            currentFeature.set('x_coord', Number(newCoords[0].toFixed(2)));
            currentFeature.set('y_coord', Number(newCoords[1].toFixed(2)));
            if (isRealEstate) {
                currentFeature.set('X', Number(coordsGlobal[0].toFixed(6)));
                currentFeature.set('Y', Number(coordsGlobal[1].toFixed(6)));
            } else {
                currentFeature.set('x_global', Number(coordsGlobal[0].toFixed(6)));
                currentFeature.set('y_global', Number(coordsGlobal[1].toFixed(6)));
            }

            sendWFS_T(currentFeature, 'update');
        }
    });

    function setupInteractions(mode) {
        deactivatePointEditTools();
        selectedLayerName = editLayerSelect.value;
        if (!selectedLayerName) {
            alert('يرجى اختيار طبقة أولاً من القائمة المنسدلة قبل تفعيل أدوات الرسم أو التعديل.');
            return;
        }
        const layer = overlayLayersObj[selectedLayerName];
        if (!layer) return alert('خطأ: الطبقة البرمجية غير موجودة');
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
                    if (confirm('هل أنت متأكد من حذف هذا المعلم نهائياً من السيرفر؟')) {
                        sendWFS_T(currentFeature, 'delete');
                    } else {
                        select.getFeatures().clear();
                        deactivatePointEditTools();
                    }
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
        modalTitle.textContent = currentTransactionType === 'insert' ? 'إضافة معلم جديد' : 'تعديل البيانات الحالية';
        attributeForm.innerHTML = '';
        
        attributeModal.style.display = 'block';
        attributeModal.style.position = 'fixed';
        attributeModal.style.top = '50%';
        attributeModal.style.left = '50%';
        attributeModal.style.transform = 'translate(-50%, -50%)';
        attributeModal.style.maxHeight = '85vh'; 
        attributeModal.style.overflowY = 'auto';  
        attributeModal.style.backgroundColor = '#fff';
        attributeModal.style.zIndex = '10001';   
        attributeModal.style.width = '450px';    
        attributeModal.style.maxWidth = '95%';   
        attributeModal.style.borderRadius = '8px';
        attributeModal.style.padding = '20px';
        attributeModal.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)';
        
        const isRealEstate = realEstateLayers.some(layer => selectedLayerName.includes(layer));
        const activeFields = isRealEstate ? fieldsRealEstate : fieldsServices;

        activeFields.forEach(f => {
            const div = document.createElement('div');
            div.className = 'form-group';
            div.style.marginBottom = '14px';
            div.style.textAlign = 'right';

            let val = feature.get(f.name);
            if (val === undefined || val === null) val = '';
            if (f.type === 'date' && val) {
                try { val = new Date(val).toISOString().split('T')[0]; } catch(e) { val = ''; }
            }

            let inputHTML = '';
            if (f.type === 'hours') {
                inputHTML = `<div style="display:flex; gap:5px;">
                                <input type="text" id="inp_${f.name}" name="${f.name}" value="${val || ''}" placeholder="مثال: 08:00-16:00" style="flex:1; padding:8px; border:1px solid #ccc; border-radius:4px;">
                                <button type="button" onclick="document.getElementById('inp_${f.name}').value='متوفر 24 ساعة'" style="cursor:pointer; padding:0 10px; background:#e1e1e1; border:1px solid #bbb; border-radius:4px;">24 ساعة</button>
                             </div>`;
            } else if (f.type === 'date') {
                inputHTML = `<input type="date" name="${f.name}" value="${val}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
            } else if (f.type === 'number') {
                inputHTML = `<input type="number" name="${f.name}" value="${val}" step="any" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px;">`;
            } else {
                let align = (f.name === 'whatsapp') ? 'ltr' : 'rtl';
                inputHTML = `<input type="text" name="${f.name}" value="${val}" style="width:100%; padding:8px; border:1px solid #ccc; border-radius:4px; direction:${align};">`;
            }

            div.innerHTML = `<label style="display:block; font-weight:bold; margin-bottom:6px; color:#333;">${f.label}:</label>${inputHTML}`;
            attributeForm.appendChild(div);
        });
    }

    function submitAttributes() {
        if (!currentFeature) return;

        const formData = new FormData(attributeForm);
        const isRealEstate = realEstateLayers.some(layer => selectedLayerName.includes(layer));
        const activeFields = isRealEstate ? fieldsRealEstate : fieldsServices;
        featureProperties = {};

        activeFields.forEach(f => {
            let val = formData.get(f.name);
            if (val !== null) val = val.toString().trim();
            featureProperties[f.name] = (f.type === 'number') ? (val === "" ? null : Number(val)) : val;
        });

        const cleanLayerKey = selectedLayerName.toLowerCase()
            .replace('realestate:', '')
            .replace('services:', '')
            .trim();

        const servicesMapping = {
            'electrician': 'فني كهرباء', 'ac_technician': 'فني تكييف وتبريد', 'plumber': 'سباك مواسيرجي',
            'general_maintenance': 'صيانة عامة', 'painter': 'دهان وديكور', 'carpenter': 'نجار',
            'blacksmith': 'حداد', 'builder': 'بناء ومعمار', 'house_cleaner': 'خدمات تنظيف',
            'aluminum_tech': 'فني ألمنيوم', 'car_mechanic': 'ميكانيكي سيارات', 'car_electrician': 'كهربائي سيارات',
            'tire_tech': 'بنشري إطارات', 'car_wash': 'غسيل سيارات', 'motorcycle_repair': 'صيانة دراجات نارية',
            'taxi_driver': 'مكتب تاكسي', 'delivery_services': 'خدمات توصيل', 'tow_truck': 'ونش إنقاذ',
            'cctv_installer': 'فني كاميرات مراقبة', 'party_planner': 'منظم حفلات', 'zaffa_bands': 'فرقة زفة',
            'music_bands': 'فرق موسيقية', 'photographer': 'مصور فوتوغرافي', 'party_rental': 'تأجير مستلزمات حفلات',
            'home_nurse': 'تمريض منزلي', 'masseur': 'أخصائي مساج', 'cupping_specialist': 'أخصائي حجامة',
            'nutritionist': 'أخصائي تغذية', 'truck_driver': 'سائق شاحنة', 'security_firms': 'شركات أمن وحراسة',
            'furniture_buyer': 'شراء أثاث مستعمل', 'gardener': 'تنسيق حدائق', 'pet_care': 'رعاية حيوانات أليفة',
            'clown_entertainer': 'مهرج وعروض أطفال', 'online_stores': 'متاجر أون لاين', 'villas_rent': 'فلل أجار',
            'martial_arts_gymnastics': 'فنون قتالية وجمباز', 'public_parks_recreation': 'حدائق ومناطق ترفيهية',
            'hotels': 'فنادق', 'free_distribution': 'توزيع أغراض مجاناً', 'barber_shop': 'حلاقة شباب',
            'video_design_ads': 'تصميم فيديو إعلاني', 'pharmacies_on_call': 'صيدليات مناوبة', 'taxis_on_call': 'تكاسي نظام مناوبة',
            'emergency_hospitals': 'طوارئ ومستشفيات', 'clinics': 'عيادات', 'doctors_on_call': 'دكاترة مناوبة',
            'ambulances_on_call': 'إسعاف مناوبة', 'music_training': 'تدريب موسيقى ومعاهد', 'lawyers': 'محاميين',
            'land_surveyors': 'مساحين أراضي', 'real_estate_valuers': 'مخمنين عقاريين', 'private_tutors': 'أساتذة خصوصي',
            'programmers': 'مبرمجين', 'car_delivery_on_call': 'دليفري سيارات مناوبة', 'motorcycle_delivery_on_call': 'دليفري دراجات مناوبة',
            'bicycle_delivery_on_call': 'دليفري هوائية مناوبة', 'photographers': 'مصور فوتوغرافي', 'student_research_assist': 'مساعد أبحاث طلاب'
        };

        const customTagsMapping = {
            'electrician': 'تمديدات كهربائية، صيانة كهرباء، شورت، قواطع، إنارة، تمديد شبكات، بروجكترات، صيانة منزلية',
            'ac_technician': 'تكييف، تبريد، غاز فريون، تصليح مكيفات، مكيف، سنترال، غسالات، ثلاجات، فك وتركيب',
            'plumber': 'مواسير، حنفيات، تسريب مياه، تصريف، مضخات، فلاتر مياه، جيزر، حمامات، صيانة سباكة',
            'general_maintenance': 'ترميم، تصليحات عامة، صيانة منازل، منشآت، تشطيب، خدمات منزلية شاملة',
            'painter': 'دهانات، ديكور، جدران، ورق حائط، منازل، شقق، جبصين، معجونة، طلاء، أصباغ',
            'carpenter': 'منجرة، خشب، تصليح اثاث، مطابخ، غرف نوم، ابواب خشب، فك وتركيب، نجارة، صيانة أثاث',
            'blacksmith': 'حديد، حماية نوافذ، أبواب حديد، مظلات، دربزينات، لحام حديد، ورشة حدادة',
            'builder': 'مقاولات، بناء، طوب، حجر، إسمنت، عظم، تشطيب، معمار، صبة، مقاول بنا وخرسانة',
            'house_cleaner': 'تنظيف شقق، تنظيف منازل، شطف، غسيل سجاد، تنظيف بعد البناء، عاملات تنظيف، تلميع زجاج',
            'aluminum_tech': 'ألمنيوم، شبابيك، أبواب ألمنيوم، مطابخ ألمنيوم، أباجورات، صيانة ألمنيوم، زجاج دبل',
            'car_mechanic': 'ميكانيك، تصليح سيارات، كراج، فحص كمبيوتر، غيار زيت، فرامل، بريكات، موتور، صيانة عامة',
            'car_electrician': 'كهرباء سيارات، دينامو، بطاريات سيارات، ضفيرة، فحص كمبيوتر، تكييف سيارات، كشافات',
            'tire_tech': 'بنشري، عجلات، إطارات، تيوبلس، رقعة، عيار هواء، ميزان سيارات، رصاص، جنطات',
            'car_wash': 'غسيل سيارات، مغسلة، تنظيف بولش، تنظيف داخلي، غسيل كراسي، دراي كلين، تلميع سيارات',
            'motorcycle_repair': 'تصليح دراجات، فيسبا، صيانة سكوتر، تصليح موتورات، قطع غيار دراجات، ميكانيك دراجات',
            'taxi_driver': 'مكتب تاكسي، سيارة أجرة، طلب سيارة، توصيل ركاب، مشاوير، طلبات، سفريات',
            'delivery_services': 'دليفري، توصيل طلبات، شحن، طرود، توصيل سريع، شركات توصيل، أغراض، توصيل منازل',
            'tow_truck': 'ونش إنقاذ، سحب سيارات، رافعة، سيارة معطلة، جر سيارات، سطحة، نقل مركبات',
            'cctv_installer': 'كاميرات مراقبة، أنظمة أمان، جهاز تسجيل، انتركم، شبكات، صيانة كاميرات، تركيب أجهزة',
            'party_planner': 'تجهيز حفلات، أعياد ميلاد، خطوبة، أعراس، منسق حفلات، ديكورات حفلات، بالونات',
            'zaffa_bands': 'فرقة زفة، زفات، أعراس، طبول، عرس، أحداث ومناسبات، زفة عرسان، فلكلور',
            'music_bands': 'فرق موسيقية، دي جي، مطرب، إحياء حفلات، صوتيات، أجهزة صوت، مكبرات، موسيقى حية',
            'photographer': 'جلسات تصوير، تصوير فيديو، فوتوغرافي، تصوير عرسان، تصوير منتجات، البومات، كاميرا',
            'party_rental': 'كراسي للحفلات، تأجير طاولات، خيم، سماعات، ليتات، مستلزمات مناسبات، تأجير صواوين',
            'home_nurse': 'رعاية صحية، تمريض منزلي، غيار جروح، إبر، رعاية كبار السن، مرافق طبي، ضغط وسكري',
            'masseur': 'مساج طبيعي، تدليك، استرخاء، مساج منزلي، علاج طبيعي، مساج علاجي، تشنجات عضلية',
            'cupping_specialist': 'حجامة إسلامية، حجامة جافة، حجامة رطبة، كاسات هواء، علاج بالقرن، ديدان دم',
            'nutritionist': 'دايت، رجيم، تخسيس، زيادة وزن، حمية غذائية، جدول تغذية، صحة ورشاقة، اخصائي تغذية',
            'truck_driver': 'نقل بضائع، شاحنة، نقل اثاث، شحن بري، سائق تريلا، قلاب، نقليات، توصيل بضائع ثقيلة',
            'security_firms': 'أمن وحراسة، حراس، حراسة منشآت، مرافقين، شركات أمنية، حماية، سيكيوريتي',
            'furniture_buyer': 'أثاث مستعمل، شراء اثاث، غرف نوم مستعملة، شراء أجهزة كهربائية، خردة، سكراب، أدوات منزلية',
            'gardener': 'تنسيق حدائق، قص عشب، زراعة أشجار، شبكات ري، مشاتل، تقليم، تنظيف حدائق، ثيل طبيعي',
            'pet_care': 'رعاية حيوانات، بيطري، قص شعر قطط، عيادة بيطرية، طعام حيوانات، رعاية كلاب، تدريب حيوانات',
            'clown_entertainer': 'مهرج، عروض أطفال، أعياد ميلاد، رسم على الوجوه، ساحر أطفال، مسابقات، تفهيه وألعاب',
            'online_stores': 'متجر الكتروني، تسوق اون لاين، بيع منزلي، طلبات عبر الانترنت، توصيل ملابس، منتجات',
            'villas_rent': 'شاليهات، فلل للايجار، شاليه، فيلا بمسبح، مسبح، استجمام، تأجير يومي، فلل فخمة',
            'martial_arts_gymnastics': 'كاراتيه، تايكوندو، دفاع عن النفس، جمباز أطفال، نادي رياضي، فنون قتالية، لياقة بدنية',
            'public_parks_recreation': 'أماكن ترفيهية، حدائق عامة، منتزه، ألعاب أطفال، ترفيه، رحلات عائلية، مساحات خضراء',
            'hotels': 'فنادق، حجز غرف، أجنحة فندقية، سياحة، إقامة، منامة، لوكاندة، ريزورت، فندق',
            'free_distribution': 'توزيع مجاني، لوجه الله، أغراض مجانا، تبرعات، مساعدات، توزيع ملابس، كرتات خيرية',
            'barber_shop': 'صالون حلاقة، حلاقة رجال، قص شعر، تدريج، سشوار، تنظيف بشرة، كوافير شباب، حلاقة أطفال',
            'video_design_ads': 'مونتاج، تصميم فيديو، إعلانات، موشن جرافيك، صناعة محتوى، سوشيال ميديا، تصميم جرافيك',
            'pharmacies_on_call': 'صيدلية مناوبة، صيدليات ليلية، دواء، علاج، وصفة طبية، طوارئ صيدلية، إسعاف سريع',
            'taxis_on_call': 'تاكسي مناوب، توصيل ليلى، تكاسي ليلية، مشاوير متأخرة، طلب تاكسي طوارئ',
            'emergency_hospitals': 'مستشفى طوارئ، إسعاف، عمليات، غرف عناية مكثفة، طوارئ طبية، علاج عاجل',
            'clinics': 'عيادة طبيب، دكتور، مجمع طبي، فحص طبي، عيادات تخصصية، استشارة طبية',
            'doctors_on_call': 'طبيب مناوب، دكتور ليلى، زيارة منزلية، طبيب طوارئ، استشارة طبية عاجلة',
            'ambulances_on_call': 'سيارة إسعاف، نقل مرضى، إسعاف فوري، طوارئ، هلال أحمر، مسعفين',
            'music_training': 'تعليم عود، معهد موسيقى، تدريب بيانو، غناء، آلات موسيقى، دورات موسيقى، سولفيج',
            'lawyers': 'محامي، استشارات قانونية، قضايا، محاكم، توكيل، عقود، قضايا أراضي، مستشار قانوني',
            'land_surveyors': 'مساحة أراضي، مساح مرخص، كوشان، تحديد حدود، خرائط مساحية، جي بي اس، إفراز أراضي، توقيع هندسي',
            'real_estate_valuers': 'تخمين عقاري، مخمن مرخص، تقييم عقارات، سعر الأرض، تقدير أضرار، فحص بناء، سوق عقاري',
            'private_tutors': 'دروس خصوصية، أستاذ، معلمة، تقوية طلاب، توجيهي، امتحانات، معاهد تقوية',
            'programmers': 'برمجة، مطور مواقع، جافا سكريبت، بايثون، تصميم تطبيقات، مبرمج ويب، صيانة برمجيات',
            'car_delivery_on_call': 'دليفري سيارات، توصيل طلبات كبير، دليفري مناوب، نقل سريع بالسيارة',
            'motorcycle_delivery_on_call': 'دليفري دراجات، توصيل اكل سريع، طلبات موتور، دليفري ليلي مناوب',
            'bicycle_delivery_on_call': 'توصيل بايسكل، دليفري دراجة هوائية، توصيل قريب، صديق للبيئة',
            'photographers': 'مصورين، جلسات تصوير خارجية، تصوير مناسبات، تصوير احترافي، كاميرات ريج',
            'student_research_assist': 'مشاريع تخرج، ابحاث طلابية، تنسيق رسائل، مساعدة جامعية، كتابة تقارير، تحليل إحصائي'
        };

        if (cleanLayerKey === 'rentlayer' || cleanLayerKey === 'apartrent') {
            featureProperties['search_tags'] = 'شقة للايجار، شقق، أجار شهري، سكن طلاب، عائلات، أجار سنوي، مفروش';
        } 
        else if (cleanLayerKey === 'salelayer' || cleanLayerKey === 'apartsale') {
            featureProperties['search_tags'] = 'شقة للبيع، شقق تمليك، عقارات، كاش، أقساط، شقة سكنية، كوشان، اموال غير منقولة، بيع شراء ،سند طابو';
        } 
        else {
            const serviceArabicName = servicesMapping[cleanLayerKey] || servicesMapping[cleanLayerKey.replace('layer', '')] || cleanLayerKey;
            const extraTags = customTagsMapping[cleanLayerKey] || customTagsMapping[cleanLayerKey.replace('layer', '')] || '';
            
            const providerName = featureProperties['name'] || '';
            const description = featureProperties['des'] || '';
            
            let tagsResult = [serviceArabicName, providerName, (description || "").trim().substring(0, 40)].map(s => s.trim()).filter(s => s.length > 0).join('، ');
            
            if (extraTags) {
                tagsResult += `، ${extraTags}`;
            }
            
            featureProperties['search_tags'] = tagsResult;
        }
        
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
            featureProperties['status'] = 0;
            featureProperties['auto_status'] = 0;
            if(!featureProperties['rating']) featureProperties['rating'] = 5; 
        }

        currentFeature.setProperties(featureProperties);
        attributeModal.style.display = 'none';

        if (currentTransactionType === 'update') {
            alert('تم حفظ البيانات الوصفية. انقر على الخريطة لتحديد الموقع الجديد، أو انتظر وسيتم الحفظ تلقائياً في الموقع الحالي.');
            isWaitingForNewLocation = true;
            map.getTargetElement().style.cursor = 'crosshair';
            
            updateTimeoutToken = setTimeout(() => {
                if (isWaitingForNewLocation) {
                    isWaitingForNewLocation = false;
                    map.getTargetElement().style.cursor = '';
                    sendWFS_T(currentFeature, 'update');
                }
            }, 4000);
        } else {
            sendWFS_T(currentFeature, currentTransactionType);
        }
    }

    populatePointLayers();
    
    if (editLayerSelect) {
        editLayerSelect.onchange = () => {
            selectedLayerName = editLayerSelect.value;
            deactivatePointEditTools(); 
        };
    }
    
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = () => submitAttributes();
    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => deactivatePointEditTools();
}