// js/main.js

if (typeof proj4 !== 'undefined') {
    proj4.defs('EPSG:28191', '+proj=tmerc +lat_0=31.73409694444444 +lon_0=35.21208055555556 +k=1.00000 +x_0=170211.555 +y_0=126790.909 +ellps=GRS80 +towgs84=-108.973,-34.502,-119.85,-0.00511,-0.00021,0.00026,-0.57398 +units=m +no_defs +type=crs');
    ol.proj.proj4.register(proj4);
}

window.overlayLayersObj = {}; 

document.addEventListener('DOMContentLoaded', () => {
    const layers = window.appLayers || {};
    const baseKeys = ['aerialLayer', 'osmBaseLayer', 'esriImageryLayer', 'noBasemapLayer'];
    const mapLayersArray = [];

    Object.keys(layers).forEach(key => {
        const lyr = layers[key];
        if (lyr && (lyr instanceof ol.layer.Layer || lyr instanceof ol.layer.Group)) {
            if (baseKeys.includes(key)) {
                lyr.setVisible(key === 'aerialLayer');
            } else {
                if (key.toLowerCase().includes('road') || key.toLowerCase().includes('street') || key === 'roadsLayer') {
                    lyr.setVisible(false);
                } else {
                    lyr.setVisible(true);
                }
                window.overlayLayersObj[key] = lyr;
            }
            mapLayersArray.push(lyr);
        }
    });

    const map = new ol.Map({
        target: 'map',
        layers: mapLayersArray,
        view: new ol.View({
            projection: 'EPSG:28191',
            center: [169463.41, 145767.99],
            zoom: 17
        })
    });

    // دالة لتعبئة قائمة الطبقات بناءً على نوع التحرير (نقطة، مضلع، خط)
    const populateEditLayerSelect = (editType) => {
        const editSelect = document.getElementById('edit-layer-select');
        const titleEl = document.getElementById('edit-panel-title');
        if (!editSelect) return;
        
        editSelect.innerHTML = '<option value="">--- اختر طبقة للتحرير ---</option>';
        
        if (editType === 'point') titleEl.innerText = "📝 تحرير النقاط";
        else if (editType === 'polygon') titleEl.innerText = "📐 تحرير المساحات";
        else if (editType === 'line') titleEl.innerText = "🛣️ تحرير الخطوط";

        Object.keys(window.overlayLayersObj).forEach(key => {
            const lyr = window.overlayLayersObj[key];
            const lyrTitle = lyr.get('title') || key;
            
            // فلترة الطبقات حسب النوع (هذا يعتمد على تسميتك للطبقات في layers.js)
            let shouldAdd = false;
            if (editType === 'point') {
                if (key.includes('Layer') && !key.includes('landLayer')) shouldAdd = true; 
            } else if (editType === 'polygon') {
                if (key === 'landLayer') shouldAdd = true; // طبقة الأراضي
            } else if (editType === 'line') {
                if (key.includes('road') || key.includes('street')) shouldAdd = true;
            }

            if (shouldAdd) {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = lyrTitle; 
                editSelect.appendChild(option);
            }
        });
    };

    window.togglePanelVisibility = (panelId, editType = null) => {
        const panel = document.getElementById(panelId);
        if (!panel) return;
        
        const isCurrentlyHidden = panel.classList.contains('hidden');
        const allPanels = ['search-panel', 'nearby-apartments-panel', 'editPanel', 'results-panel', 'measurePanel', 'shareLocationPanel', 'layerPanel'];
        
        allPanels.forEach(id => {
            const p = document.getElementById(id);
            if (p) p.classList.add('hidden');
        });

        if (isCurrentlyHidden) {
            panel.classList.remove('hidden');
            if (panelId === 'layerPanel' && typeof initializeLayerManager === 'function') {
                initializeLayerManager(map, window.overlayLayersObj);
            }
            if (panelId === 'editPanel' && editType) {
                populateEditLayerSelect(editType);
                // تفعيل الأدوات بناءً على النوع
                if (editType === 'point' && typeof initializeEditTools === 'function') {
                    initializeEditTools(map, window.overlayLayersObj);
                } else if (editType === 'polygon' && typeof initializePolygonEditTools === 'function') {
                    initializePolygonEditTools(map, window.overlayLayersObj);
                } else if (editType === 'line' && typeof initializeLineEditTools === 'function') {
                    initializeLineEditTools(map, window.overlayLayersObj);
                }
            }
        } else {
            // تعطيل كافة الأدوات عند إغلاق اللوحة
            if (typeof deactivateEditTools === 'function') deactivateEditTools();
            if (typeof deactivatePolygonEditTools === 'function') deactivatePolygonEditTools();
        }
    };

    // إعداد أزرار التحرير الثلاثة
    const editButtons = [
        { id: 'editBtn', type: 'point' },
        { id: 'polygonEditBtn', type: 'polygon' },
        { id: 'lineEditBtn', type: 'line' }
    ];

    editButtons.forEach(btnCfg => {
        const btn = document.getElementById(btnCfg.id);
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                window.togglePanelVisibility('editPanel', btnCfg.type);
            };
        }
    });

    const buttonsConfig = [
        { btnId: 'search-btn', panelId: 'search-panel' },
        { btnId: 'activate-location-btn', panelId: 'nearby-apartments-panel' },
        { btnId: 'measure-tools-toggle-btn', panelId: 'measurePanel' },
        { btnId: 'share-location-btn', panelId: 'shareLocationPanel' },
        { btnId: 'toggleLayerPanel', panelId: 'layerPanel' }
    ];

    buttonsConfig.forEach(cfg => {
        const btn = document.getElementById(cfg.btnId);
        if (btn) {
            btn.onclick = (e) => {
                e.preventDefault();
                window.togglePanelVisibility(cfg.panelId);
            };
        }
    });

    const closeButtons = [
        { btnId: 'close-nearby-panel', panelId: 'nearby-apartments-panel' },
        { btnId: 'close-search-panel', panelId: 'search-panel' },
        { btnId: 'close-edit-panel', panelId: 'editPanel' },
        { btnId: 'close-results-panel', panelId: 'results-panel' },
        { btnId: 'close-layer-panel', panelId: 'layerPanel' },
        { btnId: 'close-measure-panel', panelId: 'measurePanel' },
        { btnId: 'close-share-panel', panelId: 'shareLocationPanel' }
    ];

    closeButtons.forEach(cfg => {
        const btn = document.getElementById(cfg.btnId);
        if (btn) {
            btn.onclick = () => {
                document.getElementById(cfg.panelId).classList.add('hidden');
                if (cfg.panelId === 'editPanel') {
                    if (typeof deactivateEditTools === 'function') deactivateEditTools();
                    if (typeof deactivatePolygonEditTools === 'function') deactivatePolygonEditTools();
                }
            };
        }
    });

    const topToggle = document.getElementById('toggle-top-buttons-btn');
    if (topToggle) {
        topToggle.onclick = () => {
            const container = document.getElementById('top-buttons-container');
            if (container) container.classList.toggle('hidden-buttons-container');
        };
    }

    const initAppTools = () => {
        try { if (typeof initializePopup === 'function') initializePopup(map, window.overlayLayersObj); } catch(e) {}
        try { if (typeof initializeSearch === 'function') initializeSearch(map, window.overlayLayersObj); } catch(e) {}
        try { if (typeof initializeLocationSearch === 'function') initializeLocationSearch(map, window.overlayLayersObj); } catch(e) {}
        try { if (typeof initializeMeasureTools === 'function') initializeMeasureTools(map); } catch(e) {}
        try { if (typeof initializeShareLocationTools === 'function') initializeShareLocationTools(map); } catch(e) {}
    };

    setTimeout(initAppTools, 500);

    map.on('pointermove', (e) => {
        const el = document.getElementById('palestineCoords');
        if (el && e.coordinate) {
            el.innerText = `E: ${Math.round(e.coordinate[0])}, N: ${Math.round(e.coordinate[1])}`;
        }
    });

    const basemapSelect = document.getElementById('basemap-select');
    if (basemapSelect) {
        basemapSelect.onchange = (e) => {
            const mapping = { 'aerial': 'aerialLayer', 'osm': 'osmBaseLayer', 'esri': 'esriImageryLayer', 'none': 'noBasemapLayer' };
            baseKeys.forEach(k => { if (layers[k]) layers[k].setVisible(k === mapping[e.target.value]); });
        };
    }
    window.map = map;
});