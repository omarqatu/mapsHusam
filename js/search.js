// js/search.js
(function() {
    let mapInstance = null;
    let highlightLayer = null;
    let currentOverlayLayers = null;
    let conditions = [];

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

    let fieldSelect, operatorSelect, valueInputContainer, layerSelect, conditionsContainer;

    function getUniqueValues(layerKey, fieldId) {
        const layer = currentOverlayLayers[layerKey];
        if (!layer) return [];
        const source = layer.getSource();
        const features = source ? source.getFeatures() : [];
        const values = features.map(f => {
            const val = f.get(fieldId);
            return val != null ? String(val).trim() : null;
        }).filter(v => v !== null && v !== '');
        return [...new Set(values)].sort();
    }

    function updateValueUI() {
        const layerKey = layerSelect.value;
        const fieldId = fieldSelect.value;
        if (!layerKey || !fieldId || !valueInputContainer) return;
        valueInputContainer.innerHTML = '';
        const uniqueValues = getUniqueValues(layerKey, fieldId);
        const input = document.createElement('input');
        input.id = 'value-input';
        input.className = 'search-input-field';
        input.placeholder = 'اختر أو اكتب...';
        input.setAttribute('list', 'datalist-options');
        input.autocomplete = "off";
        Object.assign(input.style, { width: "100%", padding: "8px", border: "1px solid #ccc", borderRadius: "4px" });
        const dl = document.createElement('datalist');
        dl.id = 'datalist-options';
        uniqueValues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            dl.appendChild(opt);
        });
        valueInputContainer.appendChild(input);
        valueInputContainer.appendChild(dl);
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
                const overlay = mapInstance.getOverlays().getArray().find(o => o.getElement().id === 'popup');
                if (overlay) {
                    const content = document.getElementById('popup-content');
                    content.innerHTML = cardHtml;
                    overlay.setPosition(ol.extent.getCenter(f.getGeometry().getExtent()));
                }
            };
            if (tbody) tbody.appendChild(row);
        });

        if (resultsPanel) resultsPanel.classList.remove('hidden');
        mapInstance.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50], maxZoom: 18 });
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
            layerSelect.innerHTML = '';
            const excluded = ['المدن', 'المحافظات', 'الطرق', 'city', 'gov', 'road'];
            Object.keys(overlayLayersObj).forEach(key => {
                const lyr = overlayLayersObj[key];
                const title = lyr?.get('title') || '';
                if (title && !key.toLowerCase().includes('search') && !excluded.some(word => title.includes(word))) {
                    layerSelect.innerHTML += `<option value="${key}">${title}</option>`;
                }
            });
            layerSelect.onchange = () => {
                const layerKey = layerSelect.value;
                let fields = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey) ? fieldsConfig.realEstate : 
                             (layerKey === 'locationLayer' ? fieldsConfig.locationLayer : fieldsConfig.services);
                fieldSelect.innerHTML = fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
                conditions = []; 
                renderConditions();
                updateValueUI();
            };
        }

        if (fieldSelect) fieldSelect.onchange = updateValueUI;

        document.getElementById('run-search').onclick = () => {
            const layerKey = layerSelect.value;
            const source = currentOverlayLayers[layerKey]?.getSource();
            if (!source) return;
            let matched = source.getFeatures();
            let finalConditions = [...conditions];
            const currentVal = document.getElementById('value-input')?.value.trim();
            if (finalConditions.length === 0 && currentVal) {
                finalConditions.push({ field: fieldSelect.value, fieldName: fieldSelect.options[fieldSelect.selectedIndex].text, operator: operatorSelect.value, value: currentVal });
            }
            if (finalConditions.length === 0) return alert("حدد معايير البحث.");
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
        };

        document.getElementById('add-condition').onclick = () => {
            const val = document.getElementById('value-input')?.value.trim();
            if (!val) return;
            conditions.push({ field: fieldSelect.value, fieldName: fieldSelect.options[fieldSelect.selectedIndex].text, operator: operatorSelect.value, value: val });
            renderConditions();
            document.getElementById('value-input').value = ''; 
        };

        document.getElementById('clear-search').onclick = () => {
            conditions = [];
            renderConditions();
            if (highlightLayer) highlightLayer.getSource().clear();
            document.querySelector('#results-table tbody').innerHTML = '';
            document.getElementById('results-panel').classList.add('hidden');
        };

        // زر الطباعة لبحث السمات
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
                        <p>تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')}</p>
                        ${table.outerHTML}
                    </body>
                </html>
            `);
            newWin.document.close();
            newWin.print();
        });

        if (layerSelect?.options.length > 0) layerSelect.dispatchEvent(new Event('change'));
    };
})();