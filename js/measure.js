// js/measure.js

function initializeMeasureTools(map) {
    // 1. إنشاء طبقة الرسم
    const source = new ol.source.Vector();
    const vector = new ol.layer.Vector({
        source: source,
        style: new ol.style.Style({
            fill: new ol.style.Fill({ color: 'rgba(255, 204, 51, 0.2)' }),
            stroke: new ol.style.Stroke({ color: '#ffcc33', width: 3 }),
            image: new ol.style.Circle({
                radius: 7,
                fill: new ol.style.Fill({ color: '#ffcc33' }),
                stroke: new ol.style.Stroke({ color: '#fff', width: 2 })
            })
        })
    });
    map.addLayer(vector);

    let draw; 
    const resultDiv = document.getElementById('measure-result');

    function addInteraction(type) {
        if (draw) map.removeInteraction(draw);
        
        draw = new ol.interaction.Draw({
            source: source,
            type: type
        });

        draw.on('drawstart', () => {
            if (resultDiv) resultDiv.innerText = "جاري الحساب بدقة...";
        });

        draw.on('drawend', (evt) => {
            const geom = evt.feature.getGeometry();
            let output = "";

            if (type === 'Polygon') {
                const area = ol.sphere.getArea(geom, { projection: 'EPSG:28191' });
                // تقريب لـ 3 خانات عشرية
                output = "📐 المساحة: " + area.toFixed(3) + " متر مربع";
            } 
            else if (type === 'LineString') {
                const length = ol.sphere.getLength(geom, { projection: 'EPSG:28191' });
                // تقريب لـ 3 خانات عشرية
                output = "📏 المسافة: " + length.toFixed(3) + " متر طولي";
            } 
            else if (type === 'Point') {
                const coord = geom.getCoordinates();
                // عرض الإحداثيات بدقة 3 خانات عشرية (Easting, Northing)
                output = `📍 إحداثيات دقيقة (EPSG:28191): \n E: ${coord[0].toFixed(3)} \n N: ${coord[1].toFixed(3)}`;
            }

            if (resultDiv) {
                resultDiv.style.whiteSpace = "pre-line"; // للحفاظ على نزول السطر في الإحداثيات
                resultDiv.innerText = output;
            }

            map.removeInteraction(draw);
        });

        map.addInteraction(draw);
    }

    // --- ربط الأزرار ---

    document.getElementById('measure-length-btn')?.addEventListener('click', () => addInteraction('LineString'));
    document.getElementById('measure-area-btn')?.addEventListener('click', () => addInteraction('Polygon'));
    document.getElementById('draw-point-btn')?.addEventListener('click', () => addInteraction('Point'));

    document.getElementById('clear-measure-btn')?.addEventListener('click', () => {
        source.clear();
        if (resultDiv) resultDiv.innerText = "تم مسح النتائج";
        if (draw) map.removeInteraction(draw);
    });

    document.getElementById('close-measure-panel')?.addEventListener('click', () => {
        document.getElementById('measurePanel').classList.add('hidden');
        if (draw) map.removeInteraction(draw);
    });
}