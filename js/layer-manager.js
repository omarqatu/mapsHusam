// js/layer-manager.js

function initializeLayerManager(map, overlayLayersObj) {
    const container = document.getElementById('layer-list-container');
    const closeBtn = document.getElementById('close-layer-panel');
    const panel = document.getElementById('layerPanel');

    if (!container) {
        console.error("لم يتم العثور على حاوية قائمة الطبقات");
        return;
    }

    // 1. إصلاح موضع زر الإغلاق (X) ليكون في أقصى اليسار بعيداً عن العنوان
    if (closeBtn) {
        closeBtn.style.cssText = `
            position: absolute;
            left: 15px;
            top: 15px;
            cursor: pointer;
            font-size: 20px;
            color: #ff5e5e;
            background: none;
            border: none;
            z-index: 10;
            line-height: 1;
        `;
    }

    // 2. تنسيق العنوان داخل اللوحة لضمان عدم تداخله مع الإكس
    const headerTitle = panel ? panel.querySelector('h3') : null;
    if (headerTitle) {
        headerTitle.style.cssText = `
            margin: 0;
            padding: 15px 10px 15px 40px; /* مسافة إضافية من اليسار للإكس */
            font-size: 18px;
            color: #333;
            border-bottom: 1px solid #eee;
            text-align: right;
        `;
    }

    // 3. تنظيف المحتوى القديم
    container.innerHTML = ''; 

    // 4. أزرار التحكم الجماعي (تصميم يشبه الصور المرفقة)
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
        btn.style.cssText = `
            flex: 1; 
            cursor: pointer; 
            font-size: 12px; 
            padding: 10px 5px; 
            border-radius: 8px; 
            border: 1px solid #e0e0e0; 
            background: #fff; 
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            font-weight: bold;
            color: #555;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        `;
        
        btn.onclick = () => {
            Object.keys(overlayLayersObj).forEach(key => {
                const layer = overlayLayersObj[key];
                if (layer instanceof ol.layer.Base) {
                    layer.setVisible(visible);
                    const cb = document.getElementById('chk-' + key);
                    if (cb) cb.checked = visible;
                }
            });
        };
        return btn;
    };

    controlsDiv.appendChild(createBtn('إظهار الكل ✅', true));
    controlsDiv.appendChild(createBtn('إخفاء الكل ❌', false));
    container.appendChild(controlsDiv);

    // 5. بناء قائمة الطبقات (Checkbox على اليسار والنص على اليمين)
    const listWrapper = document.createElement('div');
    listWrapper.style.cssText = "max-height: 400px; overflow-y: auto; padding: 0 5px; direction: rtl;";

    Object.keys(overlayLayersObj).forEach(key => {
        const layer = overlayLayersObj[key];
        const title = layer.get('title');
        
        if (!title || key.toLowerCase().includes('highlight') || key.toLowerCase().includes('marker')) return; 

        const item = document.createElement('div');
        item.style.cssText = `
            display: flex; 
            align-items: center; 
            justify-content: space-between;
            padding: 12px 10px; 
            border-bottom: 1px solid #f9f9f9;
        `;

        const label = document.createElement('label');
        label.htmlFor = 'chk-' + key;
        label.textContent = title;
        label.style.cssText = "cursor: pointer; font-size: 14px; color: #444; flex: 1; text-align: right;";

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'chk-' + key;
        checkbox.checked = layer.getVisible();
        checkbox.style.cssText = "width: 18px; height: 18px; cursor: pointer; margin-right: 15px;";

        checkbox.onchange = (e) => {
            layer.setVisible(e.target.checked);
        };

        item.appendChild(label);
        item.appendChild(checkbox);
        listWrapper.appendChild(item);
    });

    container.appendChild(listWrapper);
}