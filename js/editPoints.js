/**
 * editPoints.js - النسخة النهائية المصححة 2026
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

    const realEstateLayers = ['rentLayer', 'saleLayer']; 

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
        { name: 'rating', label: 'التقييم (1-10)', type: 'number' },
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
            const excluded = ['locationLayer', 'cityLayer', 'landLayer', 'governorateLayer', 'roadsLayer', 'searchMarkerLayer', 'searchResultsHighlightLayer', 'landSaleLayer', 'villagesLayer', 'governoratesLayer', 'areasLayer'];
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
        // تعديلات CSS لضمان التمرير وظهور كامل الواجهة مهما كان الزووم
attributeModal.style.position = 'fixed';
attributeModal.style.top = '50%';
attributeModal.style.left = '50%';
attributeModal.style.transform = 'translate(-50%, -50%)';
attributeModal.style.maxHeight = '90vh'; // حد أقصى للارتفاع 90% من طول الشاشة
attributeModal.style.overflowY = 'auto';  // تفعيل التمرير العمودي بالعجل إذا تجاوزت النافذة الطول
attributeModal.style.backgroundColor = '#fff';
attributeModal.style.zIndex = '10001';   // التأكد من ظهورها فوق الخريطة والأزرار
attributeModal.style.width = '450px';     // عرض مناسب للنافذة
attributeModal.style.maxWidth = '95%';   // لضمان التناسق على الشاشات الصغيرة جداً
attributeModal.style.borderRadius = '8px';
attributeModal.style.padding = '15px';
attributeModal.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
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
                                <input type="text" id="inp_${f.name}" name="${f.name}" value="${val || ''}" placeholder="مثال: 08:00-16:00" style="flex:1; padding:8px;">
                                <button type="button" onclick="document.getElementById('inp_${f.name}').value='متوفر 24 ساعة'" style="cursor:pointer;">24 ساعة</button>
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
        const isRealEstate = realEstateLayers.includes(selectedLayerName);
        const activeFields = isRealEstate ? fieldsRealEstate : fieldsServices;
        featureProperties = {};

        activeFields.forEach(f => {
            let val = formData.get(f.name);
            
            // تعديل الواتساب: نأخذ القيمة كما هي مدخلة وننظف الفراغات المحيطة فقط
            if (f.name === 'whatsapp' && val) {
                val = val.toString().trim(); 
            }
            
            featureProperties[f.name] = (f.type === 'number') ? (val === "" ? null : Number(val)) : val;
        });

// ==========================================
        //  منطقة حقن الكلمات الدلالية الافتراضية المطور (search_tags) - نسخة 2026 الشاملة
        // ==========================================
        
        // 1. تنظيف وتوحيد اسم الطبقة
        const cleanLayerKey = selectedLayerName.toLowerCase()
            .replace('realestate:', '')
            .replace('services:', '')
            .trim();

        // 2. قاموس أسماء الخدمات والمهن
        const servicesMapping = {
            'electrician': 'فني كهرباء',
            'ac_technician': 'فني تكييف وتبريد',
            'plumber': 'سباك مواسيرجي',
            'general_maintenance': 'صيانة عامة',
            'painter': 'دهان وديكور',
            'carpenter': 'نجار',
            'blacksmith': 'حداد',
            'builder': 'بناء ومعمار',
            'house_cleaner': 'خدمات تنظيف',
            'aluminum_tech': 'فني ألمنيوم',
            'car_mechanic': 'ميكانيكي سيارات',
            'car_electrician': 'كهربائي سيارات',
            'tire_tech': 'بنشري إطارات',
            'car_wash': 'غسيل سيارات',
            'motorcycle_repair': 'صيانة دراجات نارية',
            'taxi_driver': 'مكتب تاكسي',
            'delivery_services': 'خدمات توصيل',
            'tow_truck': 'ونش إنقاذ',
            'cctv_installer': 'فني كاميرات مراقبة',
            'party_planner': 'منظم حفلات',
            'zaffa_bands': 'فرقة زفة',
            'music_bands': 'فرق موسيقية',
            'photographer': 'مصور فوتوغرافي',
            'party_rental': 'تأجير مستلزمات حفلات',
            'home_nurse': 'تمريض منزلي',
            'masseur': 'أخصائي مساج',
            'cupping_specialist': 'أخصائي حجامة',
            'nutritionist': 'أخصائي تغذية',
            'truck_driver': 'سائق شاحنة',
            'security_firms': 'شركات أمن وحراسة',
            'furniture_buyer': 'شراء أثاث مستعمل',
            'gardener': 'تنسيق حدائق',
            'pet_care': 'رعاية حيوانات أليفة',
            'clown_entertainer': 'مهرج وعروض أطفال',
            'online_stores': 'متاجر أون لاين',
            'villas_rent': 'فلل أجار',
            'martial_arts_gymnastics': 'فنون قتالية وجمباز',
            'public_parks_recreation': 'حدائق ومناطق ترفيهية',
            'hotels': 'فنادق',
            'free_distribution': 'توزيع أغراض مجاناً',
            'barber_shop': 'حلاقة شباب',
            'video_design_ads': 'تصميم فيديو إعلاني',
            'pharmacies_on_call': 'صيدليات مناوبة',
            'taxis_on_call': 'تكاسي نظام مناوبة',
            'emergency_hospitals': 'طوارئ ومستشفيات',
            'clinics': 'عيادات',
            'doctors_on_call': 'دكاترة مناوبة',
            'ambulances_on_call': 'إسعاف مناوبة',
            'music_training': 'تدريب موسيقى ومعاهد',
            'lawyers': 'محاميين',
            'land_surveyors': 'مساحين أراضي',
            'real_estate_valuers': 'مخمنين عقاريين',
            'private_tutors': 'أساتذة خصوصي',
            'programmers': 'مبرمجين',
            'car_delivery_on_call': 'دليفري سيارات مناوبة',
            'motorcycle_delivery_on_call': 'دليفري دراجات مناوبة',
            'bicycle_delivery_on_call': 'دليفري هوائية مناوبة',
            'photographers': 'مصور فوتوغرافي',
            'student_research_assist': 'مساعد أبحاث طلاب'
        };

        // 3. قاموس الكلمات الدلالية الموسعة لكل خدمة (جاهز لتعديلاتك المستقبلية في أي وقت)
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
    'music_training': 'تعليم عود، معهد موسيقى، تدريب بيانو، غناء، آلات موسيقية، دورات موسيقى، سولفيج',
    'lawyers': 'محامي، استشارات قانونية، قضايا، محاكم، توكيل، عقود، قضايا أراضي، مستشار قانوني',
    'land_surveyors': 'مساحة أراضي، مساح مرخص، كوشان، تحديد حدود، خرائط مساحية، جي بي اس، إفراز أراضي، توقيع هندسي',
    'real_estate_valuers': 'تخمين عقاري، مخمن مرخص، تقييم عقارات، سعر الأرض، تقدير أضرار، فحص بناء، سوق عقاري',
    'private_tutors': 'دروس خصوصية، أستاذ، معلمة، تقوية طلاب، توجيهي، امتحانات، معاهد تقوية',
    'programmers': 'برمجة، مطور مواقع، جافا سكريبت، بايثون، تصميم تطبيقات، مبرمج ويب، صيانة برمجيات',
    'car_delivery_on_call': 'دليفري سيارات، توصيل طلبات كبير، دليفري مناوب، نقل سريع بالسيارة',
    'motorcycle_delivery_on_call': 'دليفري دراجات، توصيل اكل سريع، طلبات موتور، دليفري ليلي مناوب',
    'bicycle_delivery_on_call': 'توصيل بايسكل، دليفري دراجة هوائية، توصيل قريب، صديق للبيئة',
    'photographers': 'مصورين، جلسات تصوير خارجية، تصوير مناسبات، تصوير احترافي، كاميرات ريج',
    'student_research_assist': 'مشاريع تخرج، ابحاث طلابية، تنسيق رسائل، مساعدة جامعية، كتابة تقارير، تحليل إحصائي'        };

        // 4. فحص الطبقة وإسناد الكلمات الدلالية بناءً على هويتها
        if (cleanLayerKey === 'rentlayer' || cleanLayerKey === 'apartrent') {
            featureProperties['search_tags'] = 'شقة للايجار، شقق، أجار شهري، سكن طلاب، عائلات، أجار سنوي، مفروش';
        } 
        else if (cleanLayerKey === 'salelayer' || cleanLayerKey === 'apartsale') {
            featureProperties['search_tags'] = 'شقة للبيع، شقق تمليك، عقارات، كاش، أقساط، شقة سكنية، كوشان، اموال غير منقولة، بيع شراء ،سند طابو';
        } 
        else {
            // للخدمات: جلب الاسم والكلمات الدلالية الموسعة المخصصة لها
            const serviceArabicName = servicesMapping[cleanLayerKey] || servicesMapping[cleanLayerKey.replace('layer', '')] || cleanLayerKey;
            const extraTags = customTagsMapping[cleanLayerKey] || customTagsMapping[cleanLayerKey.replace('layer', '')] || '';
            
            const providerName = featureProperties['name'] || '';
            const description = featureProperties['des'] || '';
            
            // دمج القاعدة الأولى المعتمدة على المدخلات الحالية + الكلمات الدلالية المخصصة الثابتة للمهنة
            let tagsResult = [serviceArabicName, providerName,    (description || "").trim().substring(0, 40)].map(s => s.trim()).filter(s => s.length > 0).join('، ');
            
            // في حال وجود كلمات مخصصة بالقاموس، نضع فاصلة ونضيفها
            if (extraTags) {
                tagsResult += `، ${extraTags}`;
            }
            
            featureProperties['search_tags'] = tagsResult;
        }
        // ==========================================        
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
        }

        currentFeature.setProperties(featureProperties);
        attributeModal.style.display = 'none';

        if (currentTransactionType === 'update') {
            alert('تم حفظ البيانات. انقر على الخريطة لتغيير الموقع أو انتظر قليلاً للحفظ في الموقع الحالي.');
            isWaitingForNewLocation = true;
            map.getTargetElement().style.cursor = 'crosshair';
            setTimeout(() => {
                if (isWaitingForNewLocation) {
                    if (confirm("هل تريد حفظ التعديلات في الموقع الحالي؟")) {
                        isWaitingForNewLocation = false;
                        sendWFS_T(currentFeature, 'update');
                    }
                }
            }, 4000);
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
            const url = layer.getSource().getUrl();
            const urlParams = new URLSearchParams(url.split('?')[1]);
            const fullTypeName = urlParams.get('typeName') || urlParams.get('layers');
            typeName = fullTypeName.includes(':') ? fullTypeName.split(':')[1] : fullTypeName;
        } catch (e) {
            typeName = selectedLayerName.replace('Layer', '').toLowerCase();
        }

        const coords = feature.getGeometry().getCoordinates();
        const fullQualifiedName = `${workspace}:${typeName}`;
        const olId = feature.getId();
        const rawId = olId ? (olId.includes('.') ? olId.split('.').pop() : olId) : (feature.get('fid') || feature.get('id'));
        const fidValue = rawId ? `${typeName}.${rawId}` : "";

        // إضافة حقل search_tags لقائمة الأمان الخاصة بالإدخال والتحديث
        const allowedPropsAdd = isRealEstate ? 
            ['price', 'des', 'pic', 'video', 'area', 'whatsapp', 'end_date', 'work_hours', 'x_coord', 'y_coord', 'X', 'Y', 'start_date', 'status', 'auto_status', 'rating', 'search_tags'] : 
            ['name', 'whatsapp', 'des', 'pic', 'rating', 'details_link_1', 'details_link_2', 'end_date', 'work_hours', 'x_coord', 'y_coord', 'x_global', 'y_global', 'start_date', 'status', 'auto_status', 'search_tags'];

        const allowedPropsUpdate = isRealEstate ? 
            ['price', 'des', 'pic', 'video', 'area', 'whatsapp', 'end_date', 'work_hours', 'x_coord', 'y_coord', 'X', 'Y', 'rating', 'search_tags'] : 
            ['name', 'whatsapp', 'des', 'pic', 'rating', 'details_link_1', 'details_link_2', 'end_date', 'work_hours', 'x_coord', 'y_coord', 'x_global', 'y_global', 'search_tags'];

        let payload = '';
        if (type === 'insert') {
            let fieldsXML = `<${fullQualifiedName} xmlns:${workspace}="${featureNS}">`;
            fieldsXML += `<${workspace}:geom><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></${workspace}:geom>`;
            
            const props = feature.getProperties();
            for (let k in props) {
                if (allowedPropsAdd.includes(k) && props[k] !== null && props[k] !== undefined && props[k] !== "") {
                    fieldsXML += `<${workspace}:${k}>${escapeXml(props[k])}</${workspace}:${k}>`;
                }
            }
            fieldsXML += `</${fullQualifiedName}>`;
            payload = `<wfs:Insert>${fieldsXML}</wfs:Insert>`;
        } 
        else if (type === 'update') {
            if (!fidValue) return alert("خطأ: المعرف غير موجود.");
            let propsXML = '';
            const props = feature.getProperties();
            
            for (let k in props) {
                if (allowedPropsUpdate.includes(k) && props[k] !== null && props[k] !== undefined) {
                    propsXML += `<wfs:Property><wfs:Name>${workspace}:${k}</wfs:Name><wfs:Value>${escapeXml(props[k])}</wfs:Value></wfs:Property>`;
                }
            }
            propsXML += `<wfs:Property><wfs:Name>${workspace}:geom</wfs:Name><wfs:Value><gml:Point srsName="EPSG:28191"><gml:coordinates>${coords[0]},${coords[1]}</gml:coordinates></gml:Point></wfs:Value></wfs:Property>`;
            
            payload = `<wfs:Update typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}">${propsXML}<ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Update>`;
        } 
        else if (type === 'delete') {
            payload = `<wfs:Delete typeName="${fullQualifiedName}" xmlns:${workspace}="${featureNS}"><ogc:Filter><ogc:FeatureId fid="${fidValue}"/></ogc:Filter></wfs:Delete>`;
        }

        const requestXML = `<?xml version="1.0" encoding="UTF-8"?>
            <wfs:Transaction service="WFS" version="1.1.0" xmlns:wfs="http://www.opengis.net/wfs" xmlns:gml="http://www.opengis.net/gml" xmlns:ogc="http://www.opengis.net/ogc" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:${workspace}="${featureNS}" xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.1.0/wfs.xsd">
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
                console.error("GeoServer Response:", text);
                alert('فشلت العملية: تحقق من الكونسول لمعرفة السبب بالتفصيل.');
            }
        }).catch(err => {
            alert('خطأ في الاتصال بالسيرفر.');
        });
    }

    populatePointLayers();
    if(addFeatureBtn) addFeatureBtn.onclick = () => setupInteractions('add');
    if(modifyFeatureBtn) modifyFeatureBtn.onclick = () => setupInteractions('modify');
    if(deleteFeatureBtn) deleteFeatureBtn.onclick = () => setupInteractions('delete');
    if(submitAttributesBtn) submitAttributesBtn.onclick = submitAttributes;
    if(cancelAttributesBtn) cancelAttributesBtn.onclick = () => deactivatePointEditTools();
}