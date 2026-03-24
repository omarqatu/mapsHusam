/**
 * layers.js - النسخة المعدلة للتحكم الكامل في أحجام الأيقونات
 */

// دالة الستايل العامة المعدلة
window.createStyle = function (feature, resolution, options = {}) {
    // القيم الافتراضية
    const opts = { 
        fillColor: null, 
        strokeColor: '#000', 
        strokeWidth: 2, 
        labelField: null, 
        iconUrl: null, 
        iconScale: 0.8, 
        zoomThresholdForLabel: 5, 
        ...options 
    };

    let text = '';
    if (opts.labelField && resolution < opts.zoomThresholdForLabel) {
        const val = feature.get(opts.labelField);
        if (val) text = val.toString();
    }

    let styleOptions = {
        text: new ol.style.Text({
            text: text, 
            font: 'bold 14px "Open Sans", sans-serif', 
            fill: new ol.style.Fill({ color: '#333' }),
            stroke: new ol.style.Stroke({ color: '#fff', width: 3 }), 
            overflow: true
        })
    };

    const geomType = feature.getGeometry().getType();

    if (geomType.includes('Point')) {
        if (opts.iconUrl) {
            styleOptions.image = new ol.style.Icon({ 
                // [0.5, 0.5] تعني أن مركز الصورة هو الذي يوضع فوق الإحداثيات (مهم جداً عند التكبير)
                anchor: [0.5, 0.5], 
                src: opts.iconUrl, 
                scale: opts.iconScale 
            });
            // رفع النص ليكون فوق الأيقونة مباشرة
            styleOptions.text.setOffsetY(-30); 
        } else {
            styleOptions.image = new ol.style.Circle({ 
                radius: 6, 
                fill: new ol.style.Fill({ color: opts.fillColor || 'rgba(0,0,0,0.7)' }), 
                stroke: new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth })
            });
            styleOptions.text.setOffsetY(-15);
        }
    } else {
        if (opts.fillColor) styleOptions.fill = new ol.style.Fill({ color: opts.fillColor.replace('1)', '0.1)') });
        styleOptions.stroke = new ol.style.Stroke({ color: opts.strokeColor, width: opts.strokeWidth });
        if (geomType.includes('Line')) styleOptions.text.setPlacement('line');
    }
    return new ol.style.Style(styleOptions);
};

// --- التحكم في أحجام الأيقونات هنا ---

// أيقونة شقق الإيجار (جرب 0.15 أو 0.2 إذا كانت الـ 0.1 صغيرة)
window.styleRent = (f, r) => window.createStyle(f, r, { 
    fillColor: 'rgba(255, 102, 0, 1)', 
    iconUrl: 'icons/rent_icon.png', 
    iconScale: 0.25,  // <--- غير هذا الرقم لتغيير الحجم (مثلاً 0.2 لتكبير أكبر)
    labelField: 'area' 
});

// أيقونة شقق البيع
window.styleSale = (f, r) => window.createStyle(f, r, { 
    fillColor: 'rgba(0, 128, 0, 1)', 
    iconUrl: 'icons/sale_icon.png', 
    iconScale: 0.2, 
    labelField: 'area' 
});

// باقي الستايلات
window.roadsStyle = (f, r) => new ol.style.Style({ stroke: new ol.style.Stroke({ color: '#444', width: 2.5 }), text: r < 2 ? new ol.style.Text({ text: f.get('name') || '', font: '12px Arial', fill: new ol.style.Fill({ color: '#000' }), stroke: new ol.style.Stroke({ color: '#fff', width: 8 }), placement: 'line' }) : null });
window.styleLand = (f, r) => window.createStyle(f, r, { fillColor: 'rgba(255, 0, 0, 1)', strokeColor: 'red', labelField: 'area' });
window.styleLocation = (f, r) => window.createStyle(f, r, { strokeColor: 'red', labelField: 'location', zoomThresholdForLabel: 10 });
window.styleCity = (f, r) => window.createStyle(f, r, { strokeColor: 'blue', labelField: 'village_a', zoomThresholdForLabel: 20 });
window.styleGovernorate = (f, r) => window.createStyle(f, r, { strokeColor: '#000', labelField: 'gov_a', zoomThresholdForLabel: 200 });
window.styleService = (f, r) => window.createStyle(f, r, { fillColor: '#007bff', strokeColor: '#fff', labelField: 'name', zoomThresholdForLabel: 2 });