function initializeLayerManager(map, overlayLayersObj) {
    const container = document.getElementById('layer-list-container');
    const panel = document.getElementById('layerPanel');

    if (!container) return;

    // 🆕 التأكد من وجود مجموعة الأنواع المخفية (نفس المتغيّر المستخدم بـ layers.js)
    window.hiddenServiceTypes = window.hiddenServiceTypes || new Set();

    // تنظيف المحتوى القديم
    container.innerHTML = '';

    // 🆕 دالة موحّدة لإجبار إعادة رسم طبقة الخدمات فوراً بعد أي تغيير بالإخفاء/الإظهار
    function refreshServiceAllLayer() {
        const serviceLayer = overlayLayersObj['serviceAllLayer'];
        if (serviceLayer) serviceLayer.changed();
    }

    // 4. أزرار التحكم الجماعي
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = `
        display: flex; 
        gap: 10px; 
        padding: 15px 5px; 
        direction: rtl;
    `;

    const createBtn = (text, visible) => {
        const btn = document.createElement('button');
        btn.innerHTML = text;
        btn.style.cssText = `flex: 1; cursor: pointer; font-size: 12px; padding: 10px 5px; border-radius: 8px; border: 1px solid #e0e0e0; background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); font-weight: bold; color: #555; display: flex; align-items: center; justify-content: center; gap: 5px;`;

        btn.onclick = () => {
            // الطبقات الحقيقية المستقلة (العقارات وغيرها)
            Object.keys(overlayLayersObj).forEach(key => {
                const layer = overlayLayersObj[key];
                if (key === 'serviceAllLayer') return; // نتعامل معها بشكل منفصل تحت
                if (layer instanceof ol.layer.Base) {
                    layer.setVisible(visible);
                    const cb = document.getElementById('chk-' + key);
                    if (cb) cb.checked = visible;
                }
            });

            // 🆕 كل الأنواع الفرعية للخدمات دفعة واحدة
            if (window.serviceSubtypes) {
                Object.keys(window.serviceSubtypes).forEach(discriminator => {
                    if (visible) {
                        window.hiddenServiceTypes.delete(discriminator);
                    } else {
                        window.hiddenServiceTypes.add(discriminator);
                    }
                    const cb = document.getElementById('chk-svc-' + discriminator);
                    if (cb) cb.checked = visible;
                });
                refreshServiceAllLayer();
            }
        };
        return btn;
    };

    controlsDiv.appendChild(createBtn('إظهار الكل ✅', true));
    controlsDiv.appendChild(createBtn('إخفاء الكل ❌', false));
    container.appendChild(controlsDiv);

    // 5. بناء قائمة الطبقات
    const listWrapper = document.createElement('div');
    listWrapper.style.cssText = "max-height: 400px; overflow-y: auto; padding: 0 5px; direction: rtl;";

    function buildRow(labelText, checked, onChange, checkboxId) {
        const item = document.createElement('div');
        item.style.cssText = "display: flex; align-items: center; justify-content: space-between; padding: 12px 10px; border-bottom: 1px solid #f9f9f9;";

        const label = document.createElement('label');
        label.htmlFor = checkboxId;
        label.textContent = labelText;
        label.style.cssText = "cursor: pointer; font-size: 14px; color: #444; flex: 1; text-align: right;";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = checkboxId;
        checkbox.checked = checked;
        checkbox.style.cssText = "width: 18px; height: 18px; cursor: pointer; margin-right: 15px;";
        checkbox.onchange = (e) => onChange(e.target.checked);

        item.appendChild(label);
        item.appendChild(checkbox);
        return item;
    }

    // 5-أ) الطبقات الحقيقية المستقلة (العقارات وغيرها) - نفس المنطق القديم تماماً
    Object.keys(overlayLayersObj).forEach(key => {
        const layer = overlayLayersObj[key];
        const title = layer.get('title');

        if (!title || key.toLowerCase().includes('highlight') || key.toLowerCase().includes('marker')) return;
        // 🆕 لا نعرض طبقة الخدمات الموحّدة كصف واحد، بل نعرض كل نوع فرعي منها لاحقاً
        if (key === 'serviceAllLayer') return;

        const row = buildRow(title, layer.getVisible(), (isChecked) => {
            layer.setVisible(isChecked);
        }, 'chk-' + key);
        listWrapper.appendChild(row);
    });

    // 5-ب) 🆕 كل نوع خدمة فرعي (discriminator) كصف مستقل بنفس الاسم العربي والأيقونة
    if (window.serviceSubtypes) {
        const separator = document.createElement('div');
        separator.style.cssText = "padding: 10px 10px 4px; font-size: 12px; font-weight: bold; color: #888; border-top: 2px solid #eee; margin-top: 5px;";
        separator.textContent = 'الخدمات';
        listWrapper.appendChild(separator);

        Object.keys(window.serviceSubtypes).forEach(discriminator => {
            const info = window.serviceSubtypes[discriminator];
            const isCurrentlyVisible = !window.hiddenServiceTypes.has(discriminator);

            const row = buildRow(info.title, isCurrentlyVisible, (isChecked) => {
                if (isChecked) {
                    window.hiddenServiceTypes.delete(discriminator);
                } else {
                    window.hiddenServiceTypes.add(discriminator);
                }
                refreshServiceAllLayer();
            }, 'chk-svc-' + discriminator);
            listWrapper.appendChild(row);
        });
    }

    container.appendChild(listWrapper);
}