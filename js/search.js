// js/search.js
(function() {
    let mapInstance = null;
    let highlightLayer = null;
    let currentOverlayLayers = null;
    let conditions = [];

    // 🆕 دالة موحّدة لفحص حد الطلبات + تسجيل الحدث دفعة واحدة (Atomic).
    // تُستخدم من كل عمليات البحث (سريع، عالمي، ذكي، بالموقع، بدون خريطة) لضمان
    // أن كل بحث يُخصم من نفس رصيد الاتصال/الواتساب، ويمنع التنفيذ فوراً عند التجاوز.
    function getSharedUserIdForQuota() {
        try {
            const saved = localStorage.getItem('map_user');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed && (parsed.user_id || parsed.id)) return String(parsed.user_id || parsed.id);
            }
        } catch (e) {}
        if (!localStorage.getItem('map_user_guid')) {
            localStorage.setItem('map_user_guid', 'guest_' + Math.random().toString(36).substr(2, 9));
        }
        return localStorage.getItem('map_user_guid');
    }

    window.checkAndLogMapEvent = async function (eventType, provider, service) {
        const userId = getSharedUserIdForQuota();
        try {
            const res = await fetch(window.location.origin + '/api/log-map-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: userId, event_type: eventType, provider: provider || null, service: service || null })
            });

            if (res.status === 429) {
                const data = await res.json().catch(() => ({}));
                const quota = data.quota || {};
                const periodLabels = { daily: 'اليوم', weekly: 'هذا الأسبوع', monthly: 'هذا الشهر' };
                const periodText = periodLabels[quota.period] || 'هذه الفترة';
                alert(`⛔ لقد تجاوزت الحد المسموح من الطلبات (${quota.limit || ''}) ${periodText}. يرجى المحاولة لاحقاً أو التواصل مع الإدارة.`);
                return { allowed: false };
            }
            return { allowed: true };
        } catch (err) {
            console.warn('تعذر التحقق من حد الطلبات، سيتم السماح بالطلب:', err.message);
            return { allowed: true }; // Fail-open فقط عند تعذر الاتصال بالشبكة
        }
    };

    // 🆕 دالة موحّدة لإضافة قائمة اختيار العملة بجانب حقل القيمة عند البحث بالسعر
    function appendCurrencySelector(container) {
        const wrap = document.createElement('div');
        wrap.style.marginTop = '8px';

        const label = document.createElement('div');
        label.textContent = 'العملة:';
        label.style.cssText = 'font-size:12px; font-weight:bold; color:#555; margin-bottom:4px;';

        const currencySelect = document.createElement('select');
        currencySelect.id = 'value-currency-select';
        Object.assign(currencySelect.style, {
            width: "100%", padding: "10px", border: "1px solid #ccc",
            borderRadius: "4px", backgroundColor: "#fff", fontSize: "14px"
        });
        currencySelect.innerHTML = `
            <option value="">كل العملات</option>
            <option value="USD">دولار $</option>
            <option value="ILS">شيكل ₪</option>
            <option value="JOD">دينار د.أ</option>
        `;

        wrap.appendChild(label);
        wrap.appendChild(currencySelect);
        container.appendChild(wrap);
    }

    const fieldsConfig = {
        realEstate: [
            { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
            { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
            { id: 'location', name: 'الموقع', type: 'text' },
            { id: 'price', name: 'السعر', type: 'number' },
            { id: 'area', name: 'المساحة', type: 'number' }
        ],
        locationLayer: [
            { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
            { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
            { id: 'location', name: 'الموقع', type: 'text' }
        ],
        services: [
            { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
            { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
            { id: 'location_name', name: 'الموقع', type: 'text' },
            { id: 'name', name: 'الاسم', type: 'text' }
        ]
    };

    window.searchFieldsConfig = fieldsConfig;

    let fieldSelect, operatorSelect, valueInputContainer, layerSelect, conditionsContainer;

    async function getUniqueValues(layerKey, fieldId) {
        const layer = currentOverlayLayers[layerKey];
        if (!layer) return [];

        // تحديد workspace و layer name
        const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
        const workspace = isRealEstate ? 'realestate' : 'services';
        const layerNameMap = { 'rentLayer': 'ApartRent', 'saleLayer': 'ApartSale', 'landLayer': 'LandSale' };
        const layerName = layerNameMap[layerKey] || layerKey.replace('Layer', '');

        // جلب القيم من PostgreSQL مباشرة عبر API الجديد (أسرع من GeoServer)
        try {
            const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
            const params = new URLSearchParams({
                layer: layerName,
                workspace: workspace,
                field: fieldId
            });

            const response = await fetch(`${baseUrl}api/get-unique-values?${params.toString()}`);
            const data = await response.json();

            if (data.success && data.values) {
                const uniqueValues = data.values.sort();

                // تحديث UI بالقيم الجديدة
                updateValueUIWithData(uniqueValues);
                return uniqueValues;
            }
        } catch (err) {
            console.error('Error fetching unique values from PostgreSQL:', err);
            // Fallback: استخدام البيانات المحلية
            const localValues = getUniqueValuesLocal(layer, fieldId);
            updateValueUIWithData(localValues);
            return localValues;
        }

        // Fallback: استخدام البيانات المحلية
        const localValues = getUniqueValuesLocal(layer, fieldId);
        updateValueUIWithData(localValues);
        return localValues;
    }

    function getUniqueValuesLocal(layer, fieldId) {
        const source = layer.getSource();
        const features = source ? source.getFeatures() : [];
        const values = features.map(f => {
            const val = f.get(fieldId);
            return val != null ? String(val).trim() : null;
        }).filter(v => v !== null && v !== '');
        return [...new Set(values)].sort();
    }

    function updateValueUIWithData(uniqueValues) {
        if (!valueInputContainer) return;
        valueInputContainer.innerHTML = '';

        // استخدام select عادية مثل "اختر الطبقة" و "اختر الحقل"
        const select = document.createElement('select');
        select.id = 'value-input';
        select.className = 'search-input-field';

        Object.assign(select.style, {
            width: "100%",
            padding: "10px",
            border: "1px solid #ccc",
            borderRadius: "4px",
            backgroundColor: "#fff",
            fontSize: "14px",
            minHeight: "40px"
        });

        // خيار افتراضي
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- اختر قيمة --';
        select.appendChild(defaultOpt);

        // خيار "قيمة مخصصة" للكتابة
        const customOpt = document.createElement('option');
        customOpt.value = '__custom__';
        customOpt.textContent = '✏️ قيمة مخصصة (اكتب)';
        select.appendChild(customOpt);

        // إضافة جميع القيم مرتبة
        uniqueValues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            select.appendChild(opt);
        });

        // عند اختيار "قيمة مخصصة"، استبدل بـ input مع زر عودة
        select.onchange = () => {
            if (select.value === '__custom__') {
                valueInputContainer.innerHTML = '';

                const container = document.createElement('div');
                container.style.display = 'flex';
                container.style.gap = '5px';

                const input = document.createElement('input');
                input.id = 'value-input';
                input.className = 'search-input-field';
                input.placeholder = 'اكتب القيمة هنا...';
                input.autocomplete = "off";

                Object.assign(input.style, {
                    flex: "1",
                    padding: "10px",
                    border: "1px solid #ccc",
                    borderRadius: "4px",
                    backgroundColor: "#fff",
                    fontSize: "16px",
                    minHeight: "44px"
                });

                const backBtn = document.createElement('button');
                backBtn.type = 'button';
                backBtn.innerHTML = '📋';
                backBtn.title = 'العودة للقائمة';
                backBtn.style.cssText = 'padding: 0 15px; border: 1px solid #ccc; background: #f5f5f5; border-radius: 4px; cursor: pointer; font-size: 16px; minHeight: 44px; white-space: nowrap;';

                backBtn.onclick = () => {
                    updateValueUIWithData(uniqueValues);
                };

                container.appendChild(input);
                container.appendChild(backBtn);
                valueInputContainer.appendChild(container);
                container.appendChild(input);
                container.appendChild(backBtn);
                valueInputContainer.appendChild(container);
                // 🆕 إعادة إضافة قائمة العملة بعد التحويل لإدخال يدوي
                if (fieldSelect && fieldSelect.value === 'price') {
                    appendCurrencySelector(valueInputContainer);
                }
                input.focus();
                input.focus();
            }
        };

        valueInputContainer.appendChild(select);
        if (fieldSelect && fieldSelect.value === 'price') {
            appendCurrencySelector(valueInputContainer);
        }
    }
    

    function updateValueUI() {
        const layerKey = layerSelect.value;
        const fieldId = fieldSelect.value;
        if (!layerKey || !fieldId || !valueInputContainer) return;
        valueInputContainer.innerHTML = '';

        // عرض مؤشر تحميل
        valueInputContainer.innerHTML = '<div style="padding: 10px; color: #666; font-size: 14px;">جاري جلب القيم...</div>';

        // جلب القيم من السيرفر
        getUniqueValues(layerKey, fieldId);
    }

    function renderConditions() {
        if (!conditionsContainer) return;
        conditionsContainer.innerHTML = '';
        conditions.forEach((c, index) => {
            const tag = document.createElement('div');
            tag.style = "background:#f1f3f4; border:1px solid #ddd; padding:5px 10px; margin:4px 0; border-radius:4px; display:flex; justify-content:space-between; font-size:12px;";
            tag.innerHTML = `<span><b>${c.fieldName}</b> ${c.operator} <b>${c.value}</b></span>
                             <span style="color:red; cursor:pointer;" onclick="removeSearchCondition(${index})">×</span>`;
            conditionsContainer.appendChild(tag);
        });
    }

    window.removeSearchCondition = function(index) {
        conditions.splice(index, 1);
        renderConditions();
    };

    function displaySearchResults(features, layerKey) {
        const tbody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span'); 
        const resultsPanel = document.getElementById('results-panel');
        if (tbody) tbody.innerHTML = '';
        if (countSpan) countSpan.innerText = features.length; 
        if (highlightLayer) highlightLayer.getSource().clear();

        if (features.length === 0) {
            if (resultsPanel) resultsPanel.classList.add('hidden');
            alert("لا توجد نتائج.");
            return;
        }

        // ترتيب النتائج بناءً على التقييم rating تنازلياً
        features.sort((a, b) => {
            const rA = parseFloat(a.get('rating')) || 0;
            const rB = parseFloat(b.get('rating')) || 0;
            return rB - rA;
        });

        const layer = currentOverlayLayers[layerKey];
        const extent = ol.extent.createEmpty();

        features.forEach((f, i) => {
            if (highlightLayer) highlightLayer.getSource().addFeature(f);
            ol.extent.extend(extent, f.getGeometry().getExtent());
            const row = document.createElement('tr');
            row.style.cursor = 'pointer';
            const cardHtml = (typeof window.generateFeatureHtml === 'function') 
                ? window.generateFeatureHtml(f, layer) 
                : `<div style="padding:10px;">${f.get('name') || 'معلم'}</div>`;

            row.innerHTML = `<td style="vertical-align:top; text-align:center; padding-top:15px; color:#999;">${i + 1}</td>
                             <td style="padding:10px;">
                                <div class="result-card" style="border:1px solid #eee; border-radius:8px; padding:10px; background:#fff; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                                    ${cardHtml}
                                </div>
                             </td>`;
            
            row.onclick = () => {
                mapInstance.getView().fit(f.getGeometry().getExtent(), { duration: 800, maxZoom: 19 });
                const center = ol.extent.getCenter(f.getGeometry().getExtent());
                window.currentPopupCoordinate = center;
                const overlay = mapInstance.getOverlays().getArray().find(o => o.getElement().id === 'popup');
                if (overlay) {
                    const content = document.getElementById('popup-content');
                    content.innerHTML = cardHtml;
                    overlay.setPosition(center);
                }
            };
            if (tbody) tbody.appendChild(row);
        });

        if (resultsPanel) resultsPanel.classList.remove('hidden');
        mapInstance.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50], maxZoom: 19 });
    }

    window.initializeSearch = function(mapObject, overlayLayersObj) {
        mapInstance = mapObject;
        currentOverlayLayers = overlayLayersObj;
        layerSelect = document.getElementById('layer-select');
        fieldSelect = document.getElementById('field-select');
        operatorSelect = document.getElementById('operator-select');
        valueInputContainer = document.getElementById('value-input-container');
        conditionsContainer = document.getElementById('search-conditions'); 
        highlightLayer = overlayLayersObj.searchResultsHighlightLayer;

        if (layerSelect) {
            layerSelect.innerHTML = '<option value="">-- اختر الطبقة للبحث --</option>';
            const excluded = ['المدن', 'المحافظات', 'الطرق', 'المناطق', 'city', 'gov', 'road', 'locationLayer'];
            const globalExcludedKeys = MAP_CONFIG.globalExclusions || [];

            Object.keys(overlayLayersObj).forEach(key => {
                const lyr = overlayLayersObj[key];
                const title = lyr?.get('title') || '';

                // التحقق من الاستثناءات باستخدام المفتاح الأساسي للطبقة (مثل 'rentLayer' أو 'electrician')
                if (title && !key.toLowerCase().includes('search') && !excluded.some(word => title.includes(word)) && !globalExcludedKeys.includes(key.replace('Layer', ''))) {
                    layerSelect.innerHTML += `<option value="${key}">${title}</option>`;
                }
            });
            layerSelect.onchange = () => {
                const layerKey = layerSelect.value;
                if (!layerKey) {
                    fieldSelect.innerHTML = '<option value="">-- اختر الحقل --</option>';
                    if (valueInputContainer) valueInputContainer.innerHTML = '';
                    conditions = [];
                    renderConditions();
                    return;
                }
                let fields = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey) ? fieldsConfig.realEstate : 
                             (layerKey === 'locationLayer' ? fieldsConfig.locationLayer : fieldsConfig.services);
                fieldSelect.innerHTML = fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
                conditions = []; 
                renderConditions();
                updateValueUI();
            };
        }

        if (fieldSelect) fieldSelect.onchange = updateValueUI;

        document.getElementById('run-search').onclick = async () => {
            const layerKey = layerSelect.value;
            if (!layerKey) return alert("اختر الطبقة للبحث أولاً.");

            // 🆕 فحص حد الطلبات قبل تنفيذ البحث الذكي (يُحسب من نفس رصيد الاتصال/الواتساب)
            const layerTitleForQuota = layerSelect.options[layerSelect.selectedIndex]?.text || layerKey;
            if (window.checkAndLogMapEvent) {
                const quotaCheck = await window.checkAndLogMapEvent('attribute_search', null, layerTitleForQuota);
                if (!quotaCheck.allowed) return;
            }

            let finalConditions = [...conditions];
            const currentVal = document.getElementById('value-input')?.value.trim();
            if (finalConditions.length === 0 && currentVal) {
                finalConditions.push({ field: fieldSelect.value, fieldName: fieldSelect.options[fieldSelect.selectedIndex].text, operator: operatorSelect.value, value: currentVal });

                // 🆕 إضافة شرط العملة تلقائياً بنفس المسار السريع
                if (fieldSelect.value === 'price') {
                    const currencySelect = document.getElementById('value-currency-select');
                    if (currencySelect && currencySelect.value) {
                        finalConditions.push({ field: 'currency', fieldName: 'العملة', operator: '=', value: currencySelect.value });
                    }
                }
            }
            if (finalConditions.length === 0) return alert("حدد معايير البحث.");

            // تحديد workspace و layer name
            const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
            const workspace = isRealEstate ? 'realestate' : 'services';
            const layerNameMap = { 'rentLayer': 'ApartRent', 'saleLayer': 'ApartSale', 'landLayer': 'LandSale' };
            const layerName = layerNameMap[layerKey] || layerKey.replace('Layer', '');

            // استخدام البحث من السيرفر بدون BBOX للحصول على جميع النتائج
            try {
                const baseUrl = window.MAP_CONFIG?.server?.proxyUrl || (window.location.origin + "/");
                const params = new URLSearchParams({
                    layer: layerName,
                    workspace: workspace
                });

                // إضافة شروط البحث المتعددة
                if (finalConditions.length > 0) {
                    finalConditions.forEach((c, index) => {
                        params.append(`field_${index}`, c.field);
                        params.append(`operator_${index}`, c.operator);
                        params.append(`value_${index}`, c.value);
                    });
                    params.append('conditions_count', finalConditions.length);
                }

                const response = await fetch(`${baseUrl}api/search-features?${params.toString()}`);
                const data = await response.json();

                if (!data.features || data.features.length === 0) {
                    alert("لا توجد نتائج.");
                    return;
                }

                // تحويل GeoJSON إلى OpenLayers Features
                const format = new ol.format.GeoJSON();
                const features = data.features.map(f => format.readFeature(f));

                displaySearchResults(features, layerKey);
            } catch (error) {
                console.error("خطأ في البحث:", error);
                alert("حدث خطأ أثناء البحث. سيتم استخدام البحث المحلي.");

                // الفallback للبحث المحلي
                const source = currentOverlayLayers[layerKey]?.getSource();
                if (!source) return;
                let matched = source.getFeatures();
                matched = matched.filter(f => {
                    return finalConditions.every(c => {
                        const raw = f.get(c.field);
                        if (raw == null) return false;
                        const fVal = String(raw).trim().toLowerCase();
                        const sVal = String(c.value).trim().toLowerCase();
                        if (c.operator === '>') return parseFloat(fVal) >= parseFloat(sVal);
                        if (c.operator === '<') return parseFloat(fVal) <= parseFloat(sVal);
                        if (c.operator === '=') return fVal === sVal;
                        if (c.operator === 'contains') return fVal.includes(sVal);
                        return false;
                    });
                });
                displaySearchResults(matched, layerKey);
            }
        };

        document.getElementById('add-condition').onclick = () => {
            const val = document.getElementById('value-input')?.value.trim();
            if (!val) return;
            conditions.push({ field: fieldSelect.value, fieldName: fieldSelect.options[fieldSelect.selectedIndex].text, operator: operatorSelect.value, value: val });

            // 🆕 إضافة شرط العملة تلقائياً إذا كان الحقل هو السعر وتم اختيار عملة محددة
            if (fieldSelect.value === 'price') {
                const currencySelect = document.getElementById('value-currency-select');
                if (currencySelect && currencySelect.value) {
                    conditions.push({ field: 'currency', fieldName: 'العملة', operator: '=', value: currencySelect.value });
                }
            }

            renderConditions();
            
            // تهيئة الحقل بعد الإضافة حسب نوعه (تفادياً لمشاكل الخيار الفارغ في الـ select)
            const inputElem = document.getElementById('value-input');
            if (inputElem) {
                inputElem.value = '';
            }
        };
        document.getElementById('clear-search').onclick = () => {
            conditions = [];
            renderConditions();
            if (highlightLayer) highlightLayer.getSource().clear();
            document.querySelector('#results-table tbody').innerHTML = '';
            document.getElementById('results-panel').classList.add('hidden');
        };

        // زر طباعة التقرير
        document.getElementById('print-attribute-results')?.addEventListener('click', () => {
            const table = document.getElementById('results-table').cloneNode(true);
            const newWin = window.open('', '_blank');
            newWin.document.write(`
                <html>
                    <head>
                        <title>تقرير نتائج البحث</title>
                        <style>
                            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
                            th { background-color: #f8f9fa; }
                            .result-card { border: none !important; box-shadow: none !important; }
                            .popup-img-container, .popup-link, .popup-header-title, button { display: none !important; }
                        </style>
                    </head>
                    <body>
                        <h2 style="text-align: center;">تقرير نتائج البحث - منصة الخدمات والعقارات</h2>
                        <p>تاريخ الاستخراج: \${new Date().toLocaleString('ar-EG')}</p>
                        \${table.outerHTML}
                    </body>
                </html>
            `);
            newWin.document.close();
            newWin.print();
        });

        if (layerSelect?.options.length > 0) layerSelect.dispatchEvent(new Event('change'));
    };
})();