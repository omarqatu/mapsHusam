// js/search.js
(function() {
    let mapInstance = null;
    let highlightLayer = null;
    let currentOverlayLayers = null;
    let conditions = [];

    // إعدادات الحقول للبحث (Dropdown vs Text)
    const fieldsConfig = {
        realEstate: [
            { id: 'village_a', name: 'المدينة/القرية', type: 'dropdown' },
            { id: 'gov_a', name: 'المحافظة', type: 'dropdown' },
            { id: 'location', name: 'الموقع', type: 'text' },
            { id: 'price', name: 'السعر', type: 'number' },
            { id: 'area', name: 'المساحة', type: 'number' }
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
        const source = currentOverlayLayers[layerKey]?.getSource();
        if (!source) return [];
        const features = source.getFeatures();
        const values = features.map(f => f.get(fieldId)).filter(v => v != null && v !== '');
        return [...new Set(values)].sort();
    }

    function updateValueUI() {
        const layerKey = layerSelect.value;
        const fieldId = fieldSelect.value;
        const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
        const fieldInfo = (isRealEstate ? fieldsConfig.realEstate : fieldsConfig.services).find(f => f.id === fieldId);

        if (!fieldInfo) return;
        valueInputContainer.innerHTML = '';

        if (fieldInfo.type === 'dropdown') {
            const select = document.createElement('select');
            select.id = 'value-input';
            select.className = 'search-input-field';
            const values = getUniqueValues(layerKey, fieldId);
            select.innerHTML = `<option value="">-- اختر --</option>`;
            values.forEach(v => select.innerHTML += `<option value="${v}">${v}</option>`);
            valueInputContainer.appendChild(select);
        } else {
            const input = document.createElement('input');
            input.id = 'value-input';
            input.className = 'search-input-field';
            input.placeholder = 'اكتب القيمة...';
            input.setAttribute('list', 'datalist-options');
            const dl = document.createElement('datalist');
            dl.id = 'datalist-options';
            getUniqueValues(layerKey, fieldId).forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                dl.appendChild(opt);
            });
            valueInputContainer.appendChild(input);
            valueInputContainer.appendChild(dl);
        }
    }

    function renderConditions() {
        conditionsContainer.innerHTML = '';
        conditions.forEach((c, index) => {
            const tag = document.createElement('div');
            tag.className = 'condition-tag'; 
            tag.style = "background:#f9f9f9; border:1px solid #ddd; padding:5px; margin:5px 0; border-radius:4px; display:flex; justify-content:space-between; font-size:12px;";
            tag.innerHTML = `<span><b>${c.fieldName}</b> ${c.operator} <b>${c.value}</b></span>
                             <span style="color:red; cursor:pointer;" onclick="removeSearchCondition(${index})">✖</span>`;
            conditionsContainer.appendChild(tag);
        });
    }

    window.removeSearchCondition = function(index) {
        conditions.splice(index, 1);
        renderConditions();
    };

    // --- الدالة الأساسية لعرض البيانات بناءً على جداولك ---
    window.formatFeatureInfo = function(props, isReal) {
        let html = `<div style="padding:10px; line-height:1.6; text-align:right; border-bottom: 2px solid #4A90E2; background:#fff; border-radius:8px; margin-bottom:5px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">`;

        if (isReal) {
            // مجموعة العقارات (نعم للظهور)
            html += `<div style="font-weight:bold; color:#2c3e50; font-size:14px;">📍 الموقع: ${props.location || 'غير محدد'}</div>`;
            html += `<div style="color:#e67e22; font-weight:bold;">💰 السعر: ${props.price || 'اتصل لمعرفة السعر'}</div>`;
            html += `<div style="font-size:12px; color:#7f8c8d;">📏 المساحة: ${props.area || '-'} م²</div>`;
            html += `<div style="font-size:12px; color:#34495e; margin:5px 0; border-top:1px dashed #ccc; padding-top:5px;">📝 الوصف: ${props.des || 'لا يوجد وصف'}</div>`;
            html += `<div style="font-size:11px; color:#95a5a6;">🌍 ${props.gov_a || ''} - ${props.village_a || ''}</div>`;
            
            // الصور والفيديو
            let media = [];
            if (props.pic) media.push(`<a href="${props.pic}" target="_blank" style="color:#3498db;">🖼️ صورة</a>`);
            if (props.video) media.push(`<a href="${props.video}" target="_blank" style="color:#e74c3c;">🎥 فيديو</a>`);
            if (media.length > 0) html += `<div style="margin-top:8px; display:flex; gap:10px; font-size:11px;">${media.join(' | ')}</div>`;

        } else {
            // مجموعة الخدمات (نعم للظهور)
            html += `<div style="font-weight:bold; color:#2c3e50; font-size:14px;">🏢 الاسم: ${props.name || 'غير متوفر'}</div>`;
            html += `<div style="font-size:12px; color:#7f8c8d;">📍 الموقع: ${props.location_name || '-'}</div>`;
            
            // الواتساب المباشر
            if (props.whatsapp) {
                let cleanNumber = props.whatsapp.toString().replace(/\D/g, '');
                if (cleanNumber.startsWith('00')) cleanNumber = cleanNumber.substring(2);
                const waUrl = `https://wa.me/${cleanNumber}`;
                html += `<div style="margin-top:5px;"><a href="${waUrl}" target="_blank" style="background:#25D366; color:white; padding:3px 8px; border-radius:4px; text-decoration:none; font-size:12px; display:inline-block;">💬 مراسلة واتساب</a></div>`;
            }

            html += `<div style="font-size:12px; margin-top:3px;">⭐ التقييم: <span style="color:#f1c40f;">${props.rating || '5'}/5</span></div>`;
            html += `<div style="font-size:11px; color:#95a5a6;">🌍 ${props.gov_a || ''} - ${props.village_a || ''}</div>`;

            // الروابط والصورة
            let links = [];
            if (props.pic) links.push(`<a href="${props.pic}" target="_blank" style="color:#3498db;">🖼️ الصورة</a>`);
            if (props.details_link_1) links.push(`<a href="${props.details_link_1}" target="_blank" style="color:#3498db;">رابط 1</a>`);
            if (props.details_link_2) links.push(`<a href="${props.details_link_2}" target="_blank" style="color:#3498db;">رابط 2</a>`);
            if (links.length > 0) html += `<div style="margin-top:8px; display:flex; gap:10px; font-size:11px;">${links.join(' | ')}</div>`;
        }

        html += `</div>`;
        return html;
    };

    function displaySearchResults(features, layerKey) {
        const tbody = document.querySelector('#results-table tbody');
        const countSpan = document.getElementById('results-count-span'); 
        tbody.innerHTML = '';
        if (countSpan) countSpan.innerText = features.length; 

        if (highlightLayer) highlightLayer.getSource().clear();
        if (features.length === 0) {
            tbody.innerHTML = '<tr><td colspan="2" style="text-align:center; padding:20px;">لا توجد نتائج تطابق بحثك</td></tr>';
            return;
        }

        const isReal = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerKey);
        const extent = ol.extent.createEmpty();

        features.forEach((f, i) => {
            if (highlightLayer) highlightLayer.getSource().addFeature(f);
            ol.extent.extend(extent, f.getGeometry().getExtent());

            const props = f.getProperties();
            const row = document.createElement('tr');
            row.innerHTML = `<td style="width:25px; vertical-align:top; text-align:center; padding-top:12px; font-size:11px; color:#999;">${i + 1}</td>
                             <td>${window.formatFeatureInfo(props, isReal)}</td>`;
            
            row.onclick = (e) => {
                if (e.target.tagName !== 'A') {
                    mapInstance.getView().fit(f.getGeometry().getExtent(), { duration: 800, maxZoom: 19 });
                }
            };
            tbody.appendChild(row);
        });

        document.getElementById('results-panel').classList.remove('hidden');
        mapInstance.getView().fit(extent, { duration: 1000, padding: [50, 50, 50, 50], maxZoom: 17 });
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

        layerSelect.innerHTML = '';
        const excluded = ['المدن', 'المحافظات', 'الطرق', 'city', 'gov', 'road'];
        
        Object.keys(overlayLayersObj).forEach(key => {
            const lyr = overlayLayersObj[key];
            const title = lyr?.get('title') || '';
            const isExcluded = excluded.some(word => title.includes(word));
            if (lyr && title && !key.toLowerCase().includes('search') && !isExcluded) {
                layerSelect.innerHTML += `<option value="${key}">${title}</option>`;
            }
        });

        layerSelect.onchange = () => {
            const isRealEstate = ['rentLayer', 'saleLayer', 'landLayer'].includes(layerSelect.value);
            const fields = isRealEstate ? fieldsConfig.realEstate : fieldsConfig.services;
            fieldSelect.innerHTML = fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
            conditions = []; 
            renderConditions();
            updateValueUI();
        };

        fieldSelect.onchange = updateValueUI;

        document.getElementById('add-condition').onclick = () => {
            const val = document.getElementById('value-input')?.value;
            if (!val) return alert("أدخل قيمة أولاً");
            conditions.push({
                field: fieldSelect.value,
                fieldName: fieldSelect.options[fieldSelect.selectedIndex].text,
                operator: operatorSelect.value,
                value: val
            });
            renderConditions();
            if(document.getElementById('value-input')) document.getElementById('value-input').value = ''; 
        };

        document.getElementById('run-search').onclick = () => {
            const source = currentOverlayLayers[layerSelect.value]?.getSource();
            if (!source) return;
            let matched = source.getFeatures();
            let searchConditions = [...conditions];
            
            if (searchConditions.length === 0) {
                const currentVal = document.getElementById('value-input')?.value;
                if (currentVal) {
                    searchConditions.push({ field: fieldSelect.value, operator: operatorSelect.value, value: currentVal });
                }
            }

            if (searchConditions.length === 0) return alert("الرجاء إضافة شرط واحد على الأقل");

            matched = matched.filter(f => {
                return searchConditions.every(c => {
                    const fValRaw = f.get(c.field);
                    const fVal = (fValRaw != null ? fValRaw : "").toString().toLowerCase();
                    const sVal = c.value.toLowerCase();
                    if (c.operator === '=') return fVal === sVal;
                    if (c.operator === 'contains') return fVal.includes(sVal);
                    if (c.operator === '>') return parseFloat(fVal) >= parseFloat(sVal);
                    if (c.operator === '<') return parseFloat(fVal) <= parseFloat(sVal);
                    return false;
                });
            });
            displaySearchResults(matched, layerSelect.value);
        };

        document.getElementById('clear-search').onclick = () => {
            conditions = [];
            renderConditions();
            if (highlightLayer) highlightLayer.getSource().clear();
            document.querySelector('#results-table tbody').innerHTML = '';
            if (document.getElementById('results-count-span')) document.getElementById('results-count-span').innerText = '0';
        };

        layerSelect.dispatchEvent(new Event('change'));
    };
})();