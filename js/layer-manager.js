// js/layer-manager.js

function initializeLayerManager(map, overlayLayersObj) {
    const container = document.getElementById('layer-list-container');
    if (!container) {
        console.error("لم يتم العثور على حاوية قائمة الطبقات: layer-list-container");
        return;
    }

    container.innerHTML = ''; // تنظيف القائمة

    // --- إضافة أزرار التحكم الجماعي (إظهار/إخفاء الكل) ---
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'layer-controls-global';
    controlsDiv.style.display = 'flex';
    controlsDiv.style.justifyContent = 'space-between';
    controlsDiv.style.marginBottom = '15px';
    controlsDiv.style.paddingBottom = '10px';
    controlsDiv.style.borderBottom = '2px solid #ddd';

    const showAllBtn = document.createElement('button');
    showAllBtn.innerHTML = '✅ إظهار الكل';
    showAllBtn.style.flex = '1';
    showAllBtn.style.margin = '0 5px';
    showAllBtn.style.cursor = 'pointer';
    showAllBtn.style.fontSize = '12px';
    showAllBtn.onclick = () => {
        Object.keys(overlayLayersObj).forEach(key => {
            overlayLayersObj[key].setVisible(true);
            const cb = document.getElementById('chk-' + key);
            if (cb) cb.checked = true;
        });
    };

    const hideAllBtn = document.createElement('button');
    hideAllBtn.innerHTML = '❌ إخفاء الكل';
    hideAllBtn.style.flex = '1';
    hideAllBtn.style.margin = '0 5px';
    hideAllBtn.style.cursor = 'pointer';
    hideAllBtn.style.fontSize = '12px';
    hideAllBtn.onclick = () => {
        Object.keys(overlayLayersObj).forEach(key => {
            overlayLayersObj[key].setVisible(false);
            const cb = document.getElementById('chk-' + key);
            if (cb) cb.checked = false;
        });
    };

    controlsDiv.appendChild(showAllBtn);
    controlsDiv.appendChild(hideAllBtn);
    container.appendChild(controlsDiv);

    // --- بناء قائمة الطبقات ---
    const sortedKeys = Object.keys(overlayLayersObj);

    sortedKeys.forEach(key => {
        const layer = overlayLayersObj[key];
        const title = layer.get('title') || key;

        const item = document.createElement('div');
        item.className = 'layer-item';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '5px';
        item.style.padding = '5px';
        item.style.borderBottom = '1px solid #eee';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = 'chk-' + key;
        checkbox.checked = layer.getVisible();
        checkbox.style.marginLeft = '10px';

        checkbox.onchange = (e) => {
            layer.setVisible(e.target.checked);
        };

        const label = document.createElement('label');
        label.htmlFor = 'chk-' + key;
        label.textContent = title;
        label.style.cursor = 'pointer';
        label.style.flex = '1';
        label.style.textAlign = 'right';
        label.style.fontSize = '13px';

        item.appendChild(checkbox);
        item.appendChild(label);
        container.appendChild(item);
    });
}