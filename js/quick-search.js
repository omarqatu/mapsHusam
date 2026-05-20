/**
 * js/quick-search.js
 * نظام البحث السريع المطور: تشمل 59 طبقة (34 قديمة + 25 جديدة)
 * تمرير بالأسهم + عرض نتائج بتنسيق البطاقات + تمييز أصفر + تفعيل زر الإغلاق + زووم تلقائي
 * تم التعديل: ترتيب النتائج بناءً على حقل rating تنازلياً
 */

function initializeQuickSearch(map, overlayLayersObj) {
    const container = document.getElementById('quick-search-container');
    const btnLeft = document.getElementById('scrollLeft');
    const btnRight = document.getElementById('scrollRight');
    const resultsPanel = document.getElementById('results-panel');

    if (!container) return;

    // --- 1. تفعيل زر إغلاق لوحة النتائج (X) بطريقة مضمونة ---
    const closeQuickResults = () => {
        if (resultsPanel) {
            resultsPanel.classList.add('hidden');
            if (window.searchResultsHighlightLayer) {
                window.searchResultsHighlightLayer.getSource().clear();
            }
        }
    };

    if (resultsPanel) {
        const closeBtn = resultsPanel.querySelector('.close-btn, .fa-times, #close-results-panel');
        if (closeBtn) {
            const targetBtn = closeBtn.tagName === 'I' ? closeBtn.parentElement : closeBtn;
            targetBtn.onclick = (e) => {
                e.preventDefault();
                closeQuickResults();
            };
            targetBtn.style.cursor = 'pointer';
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !resultsPanel.classList.contains('hidden')) {
                closeQuickResults();
            }
        });
    }

    // --- 2. تفعيل أزرار التمرير (يمين/يسار) للشريط العلوي ---
    if (btnLeft && btnRight) {
        btnLeft.onclick = () => container.scrollBy({ left: -250, behavior: 'smooth' });
        btnRight.onclick = () => container.scrollBy({ left: 250, behavior: 'smooth' });
    }

    // --- 3. مصفوفة الطبقات الـ 59 (34 قديمة + 3 عقارات + 1 مناطق + 25 جديدة) ---
    const quickLayers = [
        // العقارات والمناطق
        { title: 'شقق الإيجار', icon: 'fa-home' }, { title: 'شقق البيع', icon: 'fa-key' },
        { title: 'الأراضي للبيع', icon: 'fa-map' }, { title: 'المناطق', icon: 'fa-city' },
        
        // الخدمات القديمة (34)
        { title: 'فني كهرباء', icon: 'fa-bolt' }, { title: 'فني تكييف وتبريد', icon: 'fa-snowflake' },
        { title: 'سباك (مواسيرجي)', icon: 'fa-faucet' }, { title: 'صيانة عامة', icon: 'fa-tools' },
        { title: 'دهان وديكور', icon: 'fa-paint-roller' }, { title: 'نجار', icon: 'fa-hammer' },
        { title: 'حداد', icon: 'fa-industry' }, { title: 'بناء ومعمار', icon: 'fa-hard-hat' },
        { title: 'خدمات تنظيف', icon: 'fa-broom' }, { title: 'فني ألمنيوم', icon: 'fa-window-maximize' },
        { title: 'ميكانيكي سيارات', icon: 'fa-car-wrench' }, { title: 'كهربائي سيارات', icon: 'fa-car-battery' },
        { title: 'بنشري / إطارات', icon: 'fa-circle-notch' }, { title: 'غسيل سيارات', icon: 'fa-shuttle-van' },
        { title: 'صيانة دراجات نارية', icon: 'fa-motorcycle' }, { title: 'مكتب تاكسي', icon: 'fa-taxi' },
        { title: 'خدمات توصيل', icon: 'fa-truck-delivery' }, { title: 'ونش إنقاذ', icon: 'fa-truck-pickup' },
        { title: 'فني كاميرات مراقبة', icon: 'fa-video' }, { title: 'منظم حفلات', icon: 'fa-calendar-star' },
        { title: 'فرقة زفة', icon: 'fa-music' }, { title: 'فرق موسيقية', icon: 'fa-guitar' },
        { title: 'مصور فوتوغرافي', icon: 'fa-camera' }, { title: 'تأجير مستلزمات حفلات', icon: 'fa-chair' },
        { title: 'تمريض منزلي', icon: 'fa-user-nurse' }, { title: 'أخصائي مساج', icon: 'fa-hands-holding' },
        { title: 'أخصائي حجامة', icon: 'fa-kit-medical' }, { title: 'أخصائي تغذية', icon: 'fa-apple-whole' },
        { title: 'سائق شاحنة', icon: 'fa-truck' }, { title: 'شركات أمن وحراسة', icon: 'fa-shield-halved' },
        { title: 'شراء أثاث مستعمل', icon: 'fa-couch' }, { title: 'تنسيق حدائق', icon: 'fa-leaf' },
        { title: 'رعاية حيوانات أليفة', icon: 'fa-dog' }, { title: 'مهرج وعروض أطفال', icon: 'fa-face-smile-beam' },

        // الخدمات الجديدة (25)
        { title: 'متاجر أون لاين', icon: 'fa-shopping-basket' }, { title: 'فلل أجار', icon: 'fa-vihara' },
        { title: 'فنون قتالية وجمباز', icon: 'fa-user-ninja' }, { title: 'حدائق ومناطق ترفيهية', icon: 'fa-tree' },
        { title: 'فنادق', icon: 'fa-hotel' }, { title: 'توزيع أغراض مجاناً', icon: 'fa-gift' },
        { title: 'حلاقة شباب', icon: 'fa-cut' }, { title: 'تصميم فيديو إعلاني', icon: 'fa-film' },
        { title: 'صيدليات مناوبة', icon: 'fa-pills' }, { title: 'تكاسي نظام مناوبة', icon: 'fa-hand-holding-usd' },
        { title: 'طوارئ ومستشفيات', icon: 'fa-hospital' }, { title: 'عيادات', icon: 'fa-stethoscope' },
        { title: 'دكاترة مناوبة', icon: 'fa-user-md' }, { title: 'إسعاف مناوبة', icon: 'fa-ambulance' },
        { title: 'تدريب موسيقى ومعاهد', icon: 'fa-music' }, { title: 'محاميين', icon: 'fa-gavel' },
        { title: 'مساحين أراضي', icon: 'fa-ruler-combined' }, { title: 'مخمنين عقاريين', icon: 'fa-calculator' },
        { title: 'أساتذة خصوصي', icon: 'fa-chalkboard-teacher' }, { title: 'مبرمجين', icon: 'fa-code' },
        { title: 'دليفري سيارات (مناوبة)', icon: 'fa-car' }, { title: 'دليفري دراجات (مناوبة)', icon: 'fa-motorcycle' },
        { title: 'دليفري هوائية (مناوبة)', icon: 'fa-bicycle' }, { title: 'مصور فوتوغرافي', icon: 'fa-camera-retro' },
        { title: 'مساعد أبحاث طلاب', icon: 'fa-book' }
    ];

    quickLayers.forEach(item => {
        const btn = document.createElement('button');
        btn.className = 'quick-item';
        btn.innerHTML = `<i class="fas ${item.icon}"></i> ${item.title}`;
        btn.onclick = () => executeQuickSearch(item.title);
        container.appendChild(btn);
    });

    function executeQuickSearch(layerTitle) {
        const layerKey = Object.keys(overlayLayersObj).find(key => 
            overlayLayersObj[key].get('title') === layerTitle
        );

        if (!layerKey) {
            alert(`الطبقة "${layerTitle}" غير محملة.`);
            return;
        }

        const layer = overlayLayersObj[layerKey];
        const source = layer.getSource();
        layer.setVisible(true);

        const extent = map.getView().calculateExtent(map.getSize());
        const features = source.getFeaturesInExtent(extent);

        if (features.length === 0) {
            alert(`لا توجد نتائج لـ (${layerTitle}) في النطاق الحالي.`);
            return;
        }

        // --- 4. التمييز والزووم الاحترافي ---
        if (window.searchResultsHighlightLayer) {
            window.searchResultsHighlightLayer.getSource().clear();
            window.searchResultsHighlightLayer.getSource().addFeatures(features);
            
            const combinedExtent = window.searchResultsHighlightLayer.getSource().getExtent();
            map.getView().fit(combinedExtent, { 
                padding: [80, 80, 80, 80], 
                duration: 1000, 
                maxZoom: 18 
            });
        }

        displayQuickResults(features, layer);
    }

    function displayQuickResults(features, layer) {
        const resultsTableBody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span');

        if (!resultsPanel || !resultsTableBody) return;

        // الترتيب حسب الـ rating تنازلياً
        features.sort((a, b) => {
            const ratingA = parseFloat(a.get('rating')) || 0;
            const ratingB = parseFloat(b.get('rating')) || 0;
            return ratingB - ratingA;
        });

        resultsTableBody.innerHTML = '';
        countSpan.textContent = features.length;

        features.forEach((feat, index) => {
            const tr = document.createElement('tr');
            let featureContent = window.generateFeatureHtml ? window.generateFeatureHtml(feat, layer) : `<div>معلم ${index + 1}</div>`;

            tr.innerHTML = `
                <td style="vertical-align: top; font-weight: bold; color: #888;">${index + 1}</td>
                <td class="result-card-container">
                    <div class="quick-result-card">${featureContent}</div>
                </td>
            `;

            tr.onclick = () => {
                const geometry = feat.getGeometry();
                const coord = geometry.getType() === 'Point' ? geometry.getCoordinates() : ol.extent.getCenter(geometry.getExtent());
                map.getView().animate({ center: coord, zoom: 19, duration: 800 });
                
                if (window.generateFeatureHtml) {
                    const content = document.getElementById('popup-content');
                    if (content) content.innerHTML = featureContent;
                    map.getOverlays().forEach(ov => {
                        if (ov.getElement() && (ov.getElement().id === 'popup' || ov.getElement().classList.contains('ol-popup'))) {
                            ov.setPosition(coord);
                        }
                    });
                }
            };
            resultsTableBody.appendChild(tr);
        });

        resultsPanel.classList.remove('hidden');
    }
}