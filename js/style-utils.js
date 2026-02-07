// دالة الستايل العامة
window.createStyle = function (feature, resolution, options = {}) {
    const opts = { fillColor: null, strokeColor: '#000', strokeWidth: 2, labelField: null, iconUrl: null, iconScale: 0.8, zoomThresholdForLabel: 5, ...options };
    let text = '';
    if (opts.labelField && resolution < opts.zoomThresholdForLabel) {
        const val = feature.get(opts.labelField);
        if (val) text = val.toString();
    }
    let styleOptions = {
        text: new ol.style.Text({
            text: text, font: '14px "Open Sans", sans-serif', fill: new ol.style.Fill({ color: '#000' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }), overflow: true
        })
    };
    const geomType = feature.getGeometry().getType();
    if (geomType.includes('Point')) {
        if (opts.iconUrl) {
            styleOptions.image = new ol.style.Icon({ anchor: [0, 0], src: opts.iconUrl, scale: opts.iconScale });
            styleOptions.text.setOffsetY(-25);
        } else {
            styleOptions.image = new ol.style.Circle({ radius: 6, fill: new ol.style.Fill({ color: opts.fillColor || 'rgba(0,0,0,0.7)' }), stroke: new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth })});
            styleOptions.text.setOffsetY(-15);
        }
    } else {
        if (opts.fillColor) styleOptions.fill = new ol.style.Fill({ color: opts.fillColor.replace('1)', '0.1)') });
        styleOptions.stroke = new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth });
        if (geomType.includes('Line')) styleOptions.text.setPlacement('line');
    }
    return new ol.style.Style(styleOptions);
};

// أنماط الطبقات القديمة
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });
window.styleRent = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 102, 0, 1)', iconUrl: 'icons/rent_icon.png', iconScale: 0.05, labelField: 'area' });
window.styleSale = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(0, 128, 0, 1)', iconUrl: 'icons/sale_icon.png', iconScale: 0.1, labelField: 'area' });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area' });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 10 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 20 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });

// نمط الخدمات الجديد (يظهر اسم الشخص/المحل عند التقريب)
window.styleService = (f, r) => window.createStyle(f, r, { fillColor: '#007bff', strokeColor: '#fff', labelField: 'name', zoomThresholdForLabel: 2 });