/**
 * widgets-ticker.js
 * نظام العناصر الحيوية - إدارة البيانات والتحديثات
 * يدعم أسعار العملات، الذهب، الطقس، المحروقات، الصلاة، التقويم، الطرق، الأسواق
 *
 * 🆕 تعديل: فصل البيانات اليدوية عن البيانات من APIs
 * - القسم الأول: البيانات من APIs الخارجية (العملات، الذهب، الطقس، الصلاة، التقويم، الأسواق)
 * - القسم الثاني: البيانات اليدوية (المحروقات، الغاز، الطرق، النقل، المناسبات)
 *
 * لتعديل البيانات اليدوية، راجع ملف widgets-config.js
 * لتغيير APIs، راجع قسم WIDGETS_API_CONFIG في widgets-config.js
 */

(function () {
    'use strict';

    // ============================================
    // تحميل إعدادات التكوين
    // ============================================
    let MANUAL_DATA, API_CONFIG, DISPLAY_CONFIG;
    
    // محاولة تحميل ملف التكوين
    try {
        if (typeof WIDGETS_MANUAL_DATA !== 'undefined') {
            MANUAL_DATA = WIDGETS_MANUAL_DATA;
        }
        if (typeof WIDGETS_API_CONFIG !== 'undefined') {
            API_CONFIG = WIDGETS_API_CONFIG;
        }
        if (typeof WIDGETS_DISPLAY_CONFIG !== 'undefined') {
            DISPLAY_CONFIG = WIDGETS_DISPLAY_CONFIG;
        }
    } catch (e) {
        console.warn('Could not load widgets config, using defaults');
    }

    // ============================================
    // البيانات الافتراضية (في حال عدم تحميل التكوين)
    // ============================================
    MANUAL_DATA = MANUAL_DATA || {
        fuel: [
            { id: 'fuel-95', label: 'بنزين 95', value: '6.85', unit: 'شيكل/لتر' },
            { id: 'fuel-98', label: 'بنزين 98', value: '7.05', unit: 'شيكل/لتر' },
            { id: 'fuel-diesel', label: 'سولار', value: '6.25', unit: 'شيكل/لتر' }
        ],
        gas: [
            { id: 'gas-large', label: 'غاز حجم كبير', value: '85.00', unit: 'شيكل' },
            { id: 'gas-small', label: 'غاز حجم صغير', value: '45.00', unit: 'شيكل' }
        ],
        traffic: [
            { id: 'traffic-qalandia', label: 'حاجز قلنديا', status: 'closed', icon: 'fa-road' },
            { id: 'traffic-jerusalem', label: 'جبع القدس', status: 'open', icon: 'fa-car' },
            { id: 'traffic-hebron', label: 'طريق فرش الهوا الخليل', status: 'warning', icon: 'fa-road' }
        ],
        transport: [
            { id: 'transport-intra-city', label: 'مواصلات داخلية', value: '3.50', unit: 'شيكل' },
            { id: 'transport-inter-city', label: 'مواصلات بين المدن', value: '15.00', unit: 'شيكل' }
        ],
        events: [
            { id: 'event-1', label: 'عيد الفطر', date: '2026-06-17' },
            { id: 'event-2', label: 'عيد الأضحى', date: '2026-08-23' }
        ]
    };

    API_CONFIG = API_CONFIG || {
        currency: { enabled: true, url: '/api/currency', updateInterval: 300000 },
        gold: { enabled: true, url: '/api/gold', updateInterval: 600000 },
        weather: { enabled: true, url: '/api/weather', updateInterval: 1800000 },
        market: { enabled: true, url: '/api/market', updateInterval: 60000 },
        prayer: { enabled: true, url: '/api/prayer', updateInterval: 3600000 },
        calendar: { enabled: true, url: '/api/calendar', updateInterval: 86400000 }
    };

    DISPLAY_CONFIG = DISPLAY_CONFIG || {
        autoUpdate: true,
        defaultUpdateInterval: 300000,
        maxTickerItems: 20,
        tickerAnimationDuration: 30,
        showIcons: true,
        showUnits: true
    };

    // ============================================
    // البيانات من APIs (القسم الأول)
    // ============================================
    let apiData = {
    weather: {
        ramallah: { label: 'رام الله', temp: 28, humidity: 65, wind: 12, condition: 'غائم جزئياً' },
        gaza: { label: 'غزة', temp: 32, humidity: 70, wind: 15, condition: 'مشمس' },
        jerusalem: { label: 'القدس', temp: 26, humidity: 60, wind: 10, condition: 'غائم' }
    },
    prayer: { fajr: '04:45', dhuhr: '12:30', asr: '15:45', maghrib: '18:45', isha: '20:15' },
    calendar: { hijri: '12 رجب 1446', gregorian: '2026-08-17', events: [] }
};

// ============================================
// 🆕 البناء الديناميكي الكامل للمجموعات الست القابلة للتعديل من لوحة الإدارة
// (مركز المعلومات الحية). كل بطاقة تُبنى بالكامل من البيانات نفسها القادمة
// من السيرفر - أيقونة/اسم/رمز/وحدة/قيمة - وليس فقط القيمة كما كان سابقاً.
// هذا يضمن أن أي تعديل (حتى تغيير اسم أو رمز أو إضافة عنصر جديد بالكامل)
// ينعكس فوراً بكل الصفحات دون الحاجة لتعديل أي HTML يدوياً بعد الآن.
// ============================================
function escWidgetText(v) {
    if (v === undefined || v === null) return '';
    const d = document.createElement('div');
    d.textContent = String(v);
    return d.innerHTML;
}

const CURRENCY_FLAGS = { USD: '🇺🇸', JOD: '🇯🇴', EUR: '🇪🇺', ILS: '🇮🇱', GBP: '🇬🇧', EGP: '🇪🇬', SAR: '🇸🇦' };
function pickCurrencyFlag(item) {
    const code = (item.code || '').toUpperCase();
    for (const k in CURRENCY_FLAGS) { if (code.includes(k)) return CURRENCY_FLAGS[k]; }
    return '💱';
}
const GOLD_ICONS = ['🥇', '🥈', '🥉', '💎', '⚪'];
function pickGoldIcon(index) { return GOLD_ICONS[index % GOLD_ICONS.length]; }
function pickWeatherIcon(condition) {
    const c = (condition || '').trim();
    if (c.includes('مشمس')) return '☀️';
    if (c.includes('ممطر') || c.includes('مطر')) return '🌧️';
    if (c.includes('غائم جزئياً')) return '🌤️';
    if (c.includes('غائم')) return '☁️';
    return '🌤️';
}
function pickFuelIcon(item) {
    const id = (item.id || '').toLowerCase();
    if (id.includes('diesel')) return '🛢️';
    if (id.includes('gas')) return '🔥';
    return '⛽';
}
const EMPTY_GROUP_MSG = '<div style="padding:12px; text-align:center; color:#999; font-size:12px; grid-column:1/-1;">لا توجد عناصر بعد</div>';

function renderCurrencyGridHTML(prefix) {
    const items = MANUAL_DATA.currency || [];
    if (!items.length) return EMPTY_GROUP_MSG;
    return items.map(c => `
        <div class="currency-item">
            <div class="currency-flag">${pickCurrencyFlag(c)}</div>
            <div class="currency-info">
                <span class="currency-name">${escWidgetText(c.label)}</span>
                <span class="currency-code">${escWidgetText(c.code)}</span>
            </div>
            <div class="currency-value" id="${prefix}${escWidgetText(c.id)}">${escWidgetText(c.value)}</div>
        </div>
    `).join('');
}

function renderGoldGridHTML(prefix) {
    const items = MANUAL_DATA.gold || [];
    if (!items.length) return EMPTY_GROUP_MSG;
    return items.map((g, i) => `
        <div class="gold-item">
            <div class="gold-icon">${pickGoldIcon(i)}</div>
            <div class="gold-info">
                <span class="gold-name">${escWidgetText(g.label)}</span>
                <span class="gold-unit">${escWidgetText(g.unit)}</span>
            </div>
            <div class="gold-value" id="${prefix}${escWidgetText(g.id)}">${escWidgetText(g.value)}</div>
        </div>
    `).join('');
}

function renderWeatherGridHTML(prefix) {
    const entries = Object.entries(apiData.weather || {});
    if (!entries.length) return EMPTY_GROUP_MSG;
    return entries.map(([cityId, w]) => {
        const label = w.label || (cityId.charAt(0).toUpperCase() + cityId.slice(1));
        return `
        <div class="weather-city">
            <div class="weather-icon">${pickWeatherIcon(w.condition)}</div>
            <div class="weather-info">
                <span class="weather-city-name">${escWidgetText(label)}</span>
                <span class="weather-temp" id="${prefix}weather-${escWidgetText(cityId)}">${escWidgetText(w.temp)}°C</span>
            </div>
            <div class="weather-details">
                <span>رطوبة: ${escWidgetText(w.humidity)}%</span>
                <span>رياح: ${escWidgetText(w.wind)} كم/س</span>
            </div>
        </div>`;
    }).join('');
}

function renderFuelGridHTML(prefix) {
    const items = MANUAL_DATA.fuel || [];
    if (!items.length) return EMPTY_GROUP_MSG;
    return items.map(f => `
        <div class="fuel-item">
            <div class="fuel-icon">${pickFuelIcon(f)}</div>
            <div class="fuel-info">
                <span class="fuel-name">${escWidgetText(f.label)}</span>
                <span class="fuel-unit">${escWidgetText(f.unit)}</span>
            </div>
            <div class="fuel-value" id="${prefix}${escWidgetText(f.id)}">${escWidgetText(f.value)}</div>
        </div>
    `).join('');
}

function renderTransportGridHTML(prefix, groupKey) {
    const items = MANUAL_DATA[groupKey] || [];
    if (!items.length) return EMPTY_GROUP_MSG;
    return items.map(t => `
        <div class="transport-item">
            <div class="transport-icon">🚌</div>
            <div class="transport-info">
                <span class="transport-name">${escWidgetText(t.label)}</span>
                <span class="transport-unit">${escWidgetText(t.unit)}</span>
            </div>
            <div class="transport-value" id="${prefix}${escWidgetText(t.id)}">${escWidgetText(t.value)}</div>
        </div>
    `).join('');
}

function renderManualGroupsInto(prefix) {
    const currencyGrid = document.getElementById(prefix + 'currency-grid');
    if (currencyGrid) currencyGrid.innerHTML = renderCurrencyGridHTML(prefix);

    const goldGrid = document.getElementById(prefix + 'gold-grid');
    if (goldGrid) goldGrid.innerHTML = renderGoldGridHTML(prefix);

    const weatherGrid = document.getElementById(prefix + 'weather-grid');
    if (weatherGrid) weatherGrid.innerHTML = renderWeatherGridHTML(prefix);

    const fuelGrid = document.getElementById(prefix + 'fuel-grid');
    if (fuelGrid) fuelGrid.innerHTML = renderFuelGridHTML(prefix);

    const interGrid = document.getElementById(prefix + 'transport-inter-city-grid');
    if (interGrid) interGrid.innerHTML = renderTransportGridHTML(prefix, 'transport_inter_city');

    const intraGrid = document.getElementById(prefix + 'transport-intra-city-grid');
    if (intraGrid) intraGrid.innerHTML = renderTransportGridHTML(prefix, 'transport_intra_city');
}

    

        // 🆕 بيانات حقيقية من قاعدة البيانات (تُستبدل بها القيم الافتراضية بمجرد الوصول)
    let remoteGroupsData = {};
    let remoteRoadStatusUpdatedAt = null;
    let remoteFuelStatusUpdatedAt = null;

    function formatDateDMY(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        if (isNaN(d.getTime())) return '—';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        return `${dd}/${mm}/${d.getFullYear()}`;
    }

    async function fetchRemoteWidgetsData() {
        try {
            const res = await fetch('/api/widgets-data');
            const data = await res.json();
            if (!data.success) return;

            remoteGroupsData = data.groups || {};
            remoteRoadStatusUpdatedAt = data.road_status_updated_at;
            remoteFuelStatusUpdatedAt = data.fuel_status_updated_at;

            // استبدال القيم الافتراضية بالقيم الحقيقية المخزّنة (إن وُجدت)
            ['currency', 'gold', 'fuel', 'transport_inter_city', 'transport_intra_city'].forEach(key => {
                if (remoteGroupsData[key] && remoteGroupsData[key].items && remoteGroupsData[key].items.length > 0) {
                    MANUAL_DATA[key] = remoteGroupsData[key].items;
                }
            });
            if (remoteGroupsData.weather && remoteGroupsData.weather.items && remoteGroupsData.weather.items.length > 0) {
                const weatherObj = {};
                remoteGroupsData.weather.items.forEach(w => { weatherObj[w.id] = w; });
                apiData.weather = weatherObj;
            }

            updateAllData();
            updateTickerHTML();
            updatePortalData();
            updateMobilePortalData();
            updateLastUpdatedTimestamps();
        } catch (err) {
            console.warn('تعذر جلب بيانات مركز المعلومات الحية:', err.message);
        }
    }

        // ============================================
    // 🆕 بيانات حيّة (Live) من طبقات الخريطة مباشرة - المصدر الوحيد للتعديل
    // هو قاعدة البيانات/GeoServer نفسها، وليس أي ملف كود
    // ============================================
    let liveRoadBarriers = [];
    let liveFuelStations = [];

    async function fetchLiveLayerFeatures(layerName) {
        try {
            const params = new URLSearchParams({ layer: layerName, workspace: 'services' });
            const res = await fetch('/api/search-features?' + params.toString());
            const data = await res.json();
            return (data && data.features) ? data.features : [];
        } catch (err) {
            console.error('خطأ في جلب بيانات الطبقة ' + layerName + ':', err);
            return [];
        }
    }

    async function refreshLiveRoadBarriers() {
        liveRoadBarriers = await fetchLiveLayerFeatures('road_barriers');
        updateTickerHTML();
        updatePortalTrafficList();
        updateMobilePortalTrafficList();
    }

    async function refreshLiveFuelStations() {
        liveFuelStations = await fetchLiveLayerFeatures('fuel_stations');
        updateTickerHTML();
        updatePortalFuelStatusList();
        updateMobilePortalFuelStatusList();
        updateLastUpdatedTimestamps();
    }

    // ============================================
    // دوال العرض للبيانات اليدوية (القسم الثاني)
    // ============================================
    const TRAFFIC_LABELS = { closed: 'مغلق', open: 'مفتوح', warning: 'أزمة وتفتيش', light: 'أزمة ماشية' };
    const TRAFFIC_ICONS = { closed: 'fa-times-circle', open: 'fa-check-circle', warning: 'fa-exclamation-circle', light: 'fa-exclamation-triangle' };
    const TRAFFIC_COLORS = { closed: '#dc3545', open: '#28a745', warning: '#ffc107', light: '#ffeb3b' };

    function renderFuelTicker() {
        return MANUAL_DATA.fuel.map(f => `
            <div class="ticker-item fuel-item" data-type="fuel">
                <i class="fas fa-gas-pump"></i>
                <span class="ticker-label">${f.label}</span>
                <span class="ticker-value" id="${f.id}">${f.value}</span>
                ${DISPLAY_CONFIG.showUnits ? `<span class="ticker-unit">${f.unit}</span>` : ''}
            </div>
        `).join('');
    }

        // 🆕 حواجز الطرق: عرض كل المعالم مباشرة من الطبقة الحية (عمود stop)
    function renderTrafficTicker() {
        if (!liveRoadBarriers.length) {
            return '<div class="ticker-item traffic-item" data-type="traffic"><i class="fas fa-road"></i><span class="ticker-label">حالة الطرق</span><span class="ticker-value">جاري التحميل...</span></div>';
        }
        return liveRoadBarriers.map(f => {
            const props = f.properties || {};
            const stopInfo = window.getRoadBarrierStopInfo(window.getCaseInsensitiveProp(props, 'stop'));
            const name = props.name || 'حاجز';
            return `<div class="ticker-item traffic-item" data-type="traffic">
                <i class="fas fa-road"></i>
                <span class="ticker-label">${name}</span>
                <span class="ticker-value" style="color:${stopInfo.color};">${stopInfo.icon} ${stopInfo.label}</span>
            </div>`;
        }).join('');
    }

    // 🆕 محطات الوقود: عرض كل المعالم مباشرة من الطبقة الحية (ديزل/بنزين95/بنزين98)
    function renderFuelStationsStatusTicker() {
        if (!liveFuelStations.length) {
            return '<div class="ticker-item fuel-item" data-type="fuel-status"><i class="fas fa-gas-pump"></i><span class="ticker-label">محطات الوقود</span><span class="ticker-value">جاري التحميل...</span></div>';
        }
        return liveFuelStations.map(f => {
            const props = f.properties || {};
            const name = props.name || 'محطة وقود';
            const diesel = window.getFuelAvailabilityInfo(window.getCaseInsensitiveProp(props, 'diesel'));
            const b95 = window.getFuelAvailabilityInfo(window.getCaseInsensitiveProp(props, 'banzen95'));
            const b98 = window.getFuelAvailabilityInfo(window.getCaseInsensitiveProp(props, 'banzen98'));
            return `<div class="ticker-item fuel-item" data-type="fuel-status">
                <i class="fas fa-gas-pump"></i>
                <span class="ticker-label">${name}</span>
                <span class="ticker-value">
                    <span style="color:${diesel.color};">${diesel.icon} سولار/ديزل</span>
                    <span style="color:${b95.color}; margin-right:6px;">${b95.icon} 95</span>
                    <span style="color:${b98.color}; margin-right:6px;">${b98.icon} 98</span>
                </span>
            </div>`;
        }).join('');
    }

    // 🆕 بناء قوائم البوابة التفصيلية (Portal) لحواجز الطرق ومحطات الوقود
    function buildPortalTrafficItemsHtml() {
        if (!liveRoadBarriers.length) return '<div style="padding:10px; text-align:center; color:#999;">لا توجد بيانات حالياً</div>';
        return liveRoadBarriers.map(f => {
            const props = f.properties || {};
            const stopInfo = window.getRoadBarrierStopInfo(window.getCaseInsensitiveProp(props, 'stop'));
            const name = props.name || 'حاجز';
            return `<div class="traffic-item">
                <div class="traffic-location">${name}</div>
                <div class="traffic-status" style="color:${stopInfo.color};">${stopInfo.icon} ${stopInfo.label}</div>
            </div>`;
        }).join('');
    }

    function buildPortalFuelStatusItemsHtml() {
        if (!liveFuelStations.length) return '<div style="padding:10px; text-align:center; color:#999;">لا توجد بيانات حالياً</div>';
        return liveFuelStations.map(f => {
            const props = f.properties || {};
            const name = props.name || 'محطة وقود';
            return `<div class="traffic-item">
                <div class="traffic-location">${name}</div>
                <div class="traffic-status">${window.buildFuelAvailabilityHtml(props)}</div>
            </div>`;
        }).join('');
    }

    function updatePortalTrafficList() {
        const el = document.getElementById('portal-traffic-list');
        if (el) el.innerHTML = buildPortalTrafficItemsHtml();
    }
    function updateMobilePortalTrafficList() {
        const el = document.getElementById('mobile-portal-traffic-list');
        if (el) el.innerHTML = buildPortalTrafficItemsHtml();
    }
    function updatePortalFuelStatusList() {
        const el = document.getElementById('portal-fuel-status-list');
        if (el) el.innerHTML = buildPortalFuelStatusItemsHtml();
    }
    function updateMobilePortalFuelStatusList() {
        const el = document.getElementById('mobile-portal-fuel-status-list');
        if (el) el.innerHTML = buildPortalFuelStatusItemsHtml();
    }

    function renderTransportInterCityTicker() {
        return MANUAL_DATA.transport_inter_city.map(t => `
            <div class="ticker-item transport-item" data-type="transport">
                <i class="fas fa-bus"></i>
                <span class="ticker-label">${t.label}</span>
                <span class="ticker-value" id="${t.id}">${t.value}</span>
                ${DISPLAY_CONFIG.showUnits ? `<span class="ticker-unit">${t.unit}</span>` : ''}
            </div>
        `).join('');
    }

    function renderTransportIntraCityTicker() {
        return MANUAL_DATA.transport_intra_city.map(t => `
            <div class="ticker-item transport-item" data-type="transport">
                <i class="fas fa-bus"></i>
                <span class="ticker-label">${t.label}</span>
                <span class="ticker-value" id="${t.id}">${t.value}</span>
                ${DISPLAY_CONFIG.showUnits ? `<span class="ticker-unit">${t.unit}</span>` : ''}
            </div>
        `).join('');
    }

    function renderEventsTicker() {
        return MANUAL_DATA.events.map(e => `
            <div class="ticker-item event-item" data-type="event">
                <i class="fas fa-calendar-alt"></i>
                <span class="ticker-label">${e.label}</span>
                <span class="ticker-value" id="${e.id}">${e.date}</span>
            </div>
        `).join('');
    }

    // ============================================
    // دوال العرض للبيانات اليدوية (العملات والذهب)
    // ============================================
    function renderCurrencyTicker() {
        return MANUAL_DATA.currency.map(c => `
            <div class="ticker-item currency-item" data-type="currency">
                <i class="fas fa-dollar-sign"></i>
                <span class="ticker-label">${c.label}</span>
                <span class="ticker-value" id="${c.id}">${c.value}</span>
            </div>
        `).join('');
    }

    function renderGoldTicker() {
        return MANUAL_DATA.gold.map(g => `
            <div class="ticker-item gold-item" data-type="gold">
                <i class="fas fa-gem"></i>
                <span class="ticker-label">${g.label}</span>
                <span class="ticker-value" id="${g.id}">${g.value}</span>
                ${DISPLAY_CONFIG.showUnits ? `<span class="ticker-unit">${g.unit}</span>` : ''}
            </div>
        `).join('');
    }

    function renderWeatherTicker() {
        return Object.entries(apiData.weather).map(([city, data]) => `
            <div class="ticker-item weather-item" data-type="weather">
                <i class="fas fa-cloud-sun"></i>
                <span class="ticker-label">${city.charAt(0).toUpperCase() + city.slice(1)}</span>
                <span class="ticker-value" id="weather-${city}">${data.temp}°C</span>
            </div>
        `).join('');
    }

    function renderPrayerTicker() {
        return Object.entries(apiData.prayer).map(([prayer, time]) => `
            <div class="ticker-item prayer-item" data-type="prayer">
                <i class="fas fa-mosque"></i>
                <span class="ticker-label">${prayer.charAt(0).toUpperCase() + prayer.slice(1)}</span>
                <span class="ticker-value" id="prayer-${prayer}">${time}</span>
            </div>
        `).join('');
    }

    function renderCalendarTicker() {
        return Object.entries(apiData.calendar).map(([type, value]) => `
            <div class="ticker-item calendar-item" data-type="calendar">
                <i class="fas fa-calendar"></i>
                <span class="ticker-label">${type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="ticker-value" id="${type}-date">${value}</span>
            </div>
        `).join('');
    }


    // ============================================
    // دالة موحّدة لتحديث القيمة في كل نسخ العنصر الموجودة بالصفحة
    // ============================================
    function setTickerValue(id, value) {
        ['', 'mobile-', 'portal-', 'mobile-portal-'].forEach(function (prefix) {
            const element = document.getElementById(prefix + id);
            if (element) {
                element.textContent = value;
                element.classList.add('updated');
                setTimeout(function () { element.classList.remove('updated'); }, 1000);
            }
        });
    }

        // ============================================
    // 🆕 تحديث "آخر تحديث" الحقيقي لكل مجموعة (تاريخ يدوي من widgets-config.js
    // للمجموعات الثابتة، أو تاريخ اليوم تلقائياً للمجموعات الحية/اليومية)
    // ============================================
    function formatTodayDMY() {
        const d = new Date();
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        return `${dd}/${mm}/${yyyy}`;
    }

        function setLastUpdatedValue(id, value) {
        ['', 'mobile-'].forEach(function (prefix) {
            const el = document.getElementById(prefix + id);
            if (el) el.textContent = value;
        });
    }

    function updateLastUpdatedTimestamps() {
        const todayStr = formatDateDMY(new Date().toISOString());

        setLastUpdatedValue('currency-update-time', formatDateDMY(remoteGroupsData.currency?.updated_at));
        setLastUpdatedValue('gold-update-time', formatDateDMY(remoteGroupsData.gold?.updated_at));
        setLastUpdatedValue('weather-update-time', formatDateDMY(remoteGroupsData.weather?.updated_at));
        setLastUpdatedValue('fuel-update-time', formatDateDMY(remoteGroupsData.fuel?.updated_at));
        setLastUpdatedValue('transport-inter-city-update-time', formatDateDMY(remoteGroupsData.transport_inter_city?.updated_at));
        setLastUpdatedValue('transport-intra-city-update-time', formatDateDMY(remoteGroupsData.transport_intra_city?.updated_at));

        // مجموعتان أوتوماتيك (API): تاريخ اليوم دائماً
        setLastUpdatedValue('prayer-date', todayStr);
        setLastUpdatedValue('calendar-today', todayStr);

        // حالة الطرق ومحطات الوقود: آخر تحديث فعلي من قاعدة البيانات
        setLastUpdatedValue('traffic-update-time', formatDateDMY(remoteRoadStatusUpdatedAt));
        setLastUpdatedValue('fuel-status-update-time', formatDateDMY(remoteFuelStatusUpdatedAt));
    }
        // ============================================
    // 🆕 بحث نصي مرن (يتجاهل فروقات الحروف العربية المتشابهة) لكل مجموعة
    // ============================================
    function normalizeSearchText(text) {
        if (!text) return '';
        return text.toString()
            .replace(/[أإآا]/g, 'ا').replace(/[ةه]/g, 'ه')
            .replace(/[ىي]/g, 'ي').replace(/[ؤئء]/g, 'ء')
            .toLowerCase().trim();
    }

    function filterWidgetGrid(grid, rawTerm) {
        if (!grid) return;
        const term = normalizeSearchText(rawTerm);
        const words = term.split(/\s+/).filter(Boolean);
        Array.from(grid.children).forEach(item => {
            if (!words.length) { item.style.display = ''; return; }
            const text = normalizeSearchText(item.textContent);
            item.style.display = words.every(w => text.includes(w)) ? '' : 'none';
        });
    }

    function wireWidgetSearchInputs(container) {
        if (!container) return;
        container.querySelectorAll('.widget-search-input').forEach(input => {
            if (input.dataset.wired) return;
            input.dataset.wired = '1';
            input.addEventListener('input', () => {
                const grid = container.querySelector('#' + CSS.escape(input.dataset.targetGrid))
                           || document.getElementById(input.dataset.targetGrid);
                filterWidgetGrid(grid, input.value);
            });
        });
    }

    // ============================================
    // 🆕 سكرول يدوي حقيقي لشريط "المعلومات الفورية" (سحب بالفأرة/اللمس + عجلة الفأرة)
    // بدل الأنيميشن التلقائي الثابت، حتى لا يتعارض تمرير عجلة الفأرة فوق الشريط
    // مع تمرير الصفحة نفسها
    // ============================================
        function initTickerManualScroll() {
        const content = document.querySelector('.ticker-content');
        const track = document.getElementById('ticker-scroll');
        if (!content || !track || content.dataset.manualScrollWired) return;
        content.dataset.manualScrollWired = '1';

        let userActive = false, resumeTimer = null;
        let isDragging = false, startX = 0, startScroll = 0;

        function pause() { userActive = true; clearTimeout(resumeTimer); }
        function scheduleResume() { clearTimeout(resumeTimer); resumeTimer = setTimeout(() => userActive = false, 2000); }

        function autoStep() {
            if (!userActive) {
                content.scrollLeft += 0.6;
                const half = track.scrollWidth / 2;
                if (content.scrollLeft >= half) content.scrollLeft -= half;
            }
            requestAnimationFrame(autoStep);
        }
        requestAnimationFrame(autoStep);

        content.addEventListener('mouseenter', pause);
        content.addEventListener('mouseleave', () => { if (!isDragging) scheduleResume(); });

        content.addEventListener('wheel', (e) => {
            e.preventDefault();
            pause();
            content.scrollLeft += (Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX);
            scheduleResume();
        }, { passive: false });

        content.addEventListener('mousedown', (e) => {
            isDragging = true;
            pause();
            content.classList.add('dragging');
            startX = e.pageX;
            startScroll = content.scrollLeft;
            e.preventDefault(); // 🆕 يمنع تحديد النص الافتراضي من مقاطعة عملية السحب اليدوي
        });
        window.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            content.scrollLeft = startScroll - (e.pageX - startX);
        });
        function endTickerDrag() {
            if (!isDragging) return;
            isDragging = false;
            content.classList.remove('dragging');
            scheduleResume();
        }
        window.addEventListener('mouseup', endTickerDrag);
        window.addEventListener('blur', endTickerDrag); // 🆕 يمنع بقاء حالة السحب "عالقة" إذا غادر المؤشر النافذة أثناء السحب

        let touchStartX = 0, touchStartScroll = 0;
        content.addEventListener('touchstart', (e) => {
            pause();
            touchStartX = e.touches[0].pageX;
            touchStartScroll = content.scrollLeft;
        }, { passive: true });
        content.addEventListener('touchmove', (e) => {
            content.scrollLeft = touchStartScroll - (e.touches[0].pageX - touchStartX);
        }, { passive: true });
        content.addEventListener('touchend', scheduleResume);
    }

    // ============================================
    // دالة تحديث جميع البيانات
    // ============================================
    function updateAllData() {
        // تحديث البيانات اليدوية
        MANUAL_DATA.currency.forEach(c => setTickerValue(c.id, c.value));
        MANUAL_DATA.gold.forEach(g => setTickerValue(g.id, g.value));
        MANUAL_DATA.fuel.forEach(f => setTickerValue(f.id, f.value));
        MANUAL_DATA.traffic.forEach(t => {
            const el = document.getElementById(t.id);
            if (el) {
                el.innerHTML = `<i class="fas ${TRAFFIC_ICONS[t.status]}"></i> ${TRAFFIC_LABELS[t.status]}`;
                el.style.color = TRAFFIC_COLORS[t.status];
            }
        });
        MANUAL_DATA.transport_inter_city.forEach(t => setTickerValue(t.id, t.value));
        MANUAL_DATA.transport_intra_city.forEach(t => setTickerValue(t.id, t.value));
        MANUAL_DATA.events.forEach(e => setTickerValue(e.id, e.date));

        // تحديث البيانات من APIs
        Object.entries(apiData.weather).forEach(([city, data]) => setTickerValue(`weather-${city}`, `${data.temp}°C`));
        Object.entries(apiData.prayer).forEach(([prayer, time]) => setTickerValue(`prayer-${prayer}`, time));
        Object.entries(apiData.calendar).forEach(([type, value]) => setTickerValue(`${type}-date`, value));
    }

    // ============================================
    // دالة تحميل البيانات من APIs
    // ============================================
    async function fetchFromAPI(type) {
        if (!API_CONFIG[type] || !API_CONFIG[type].enabled) return;

        try {
            const response = await fetch(API_CONFIG[type].url);
            const data = await response.json();
            
            // تحديث البيانات حسب النوع
            switch(type) {
                case 'weather':
                    Object.keys(data).forEach(city => {
                        if (apiData.weather[city]) apiData.weather[city] = data[city];
                    });
                    break;
                case 'prayer':
                    if (data.data && data.data.timings) {
                        const timings = data.data.timings;
                        apiData.prayer.fajr = timings.Fajr;
                        apiData.prayer.dhuhr = timings.Dhuhr;
                        apiData.prayer.asr = timings.Asr;
                        apiData.prayer.maghrib = timings.Maghrib;
                        apiData.prayer.isha = timings.Isha;
                    }
                    break;
                case 'calendar':
                    if (data.data) {
                        apiData.calendar.hijri = data.data.hijri.date;
                        apiData.calendar.gregorian = data.data.gregorian.date;
                    }
                    break;
            }
            
            updateAllData();
        } catch (error) {
            console.error(`Error fetching ${type} data:`, error);
        }
    }

                // ============================================
                // دالة تحديث الشريط المتحرك
                // ============================================
                const TICKER_GROUPS = [
                { id: 'portal-currency-card',        label: 'أسعار العملات',            icon: 'fa-dollar-sign' },
                { id: 'portal-gold-card',            label: 'الذهب والمعادن النفيسة',   icon: 'fa-gem' },
                { id: 'portal-weather-card',         label: 'حالة الطقس',               icon: 'fa-cloud-sun' },
                { id: 'portal-fuel-card',            label: 'المحروقات والغاز',         icon: 'fa-gas-pump' },
                { id: 'portal-transport-inter-card', label: 'النقل بين المدن',          icon: 'fa-bus' },
                { id: 'portal-transport-intra-card', label: 'النقل الداخلي',            icon: 'fa-bus' },
                { id: 'portal-prayer-card',          label: 'مواقيت الصلاة',            icon: 'fa-mosque' },
                { id: 'portal-calendar-card',        label: 'التقويم الهجري والميلادي', icon: 'fa-calendar-alt' },
                { id: 'portal-road-status-card',     label: 'حالة الطرق',               icon: 'fa-road' },
                { id: 'portal-fuel-status-card',     label: 'حالة محطات الوقود',        icon: 'fa-gas-pump' }
            ];

            function renderTickerGroupsHTML() {
                return TICKER_GROUPS.map(g => `
                    <div class="ticker-item ticker-group-item" data-target="${g.id}">
                        <i class="fas ${g.icon}"></i>
                        <span class="ticker-label">${g.label}</span>
                    </div>
                `).join('');
            }

            function updateTickerHTML() {
                const tickerScroll = document.getElementById('ticker-scroll');
                if (!tickerScroll) return;
                // تكرار القائمة مرتين لضمان حركة سلسة متصلة (نفس منطق أنيميشن scrollTicker)
                tickerScroll.innerHTML = renderTickerGroupsHTML() + renderTickerGroupsHTML();
                tickerScroll.querySelectorAll('.ticker-group-item').forEach(el => {
                    el.addEventListener('click', () => {
                        const targetId = el.getAttribute('data-target');
                        if (window.openWidgetsPortalToCard) window.openWidgetsPortalToCard(targetId);
                    });
                });
            }

    // ============================================
    // دالة تحميل HTML الشريط المتحرك
    // ============================================
                function loadTickerHTML() {
        fetch('/widgets-ticker.html')
            .then(response => response.text())
            .then(html => {
                const container = document.createElement('div');
                container.innerHTML = html;
                
                // إضافة المحتوى إلى الفوتر إذا وجد
                const footerWrapper = document.getElementById('widgets-ticker-wrapper');
                if (footerWrapper) {
                    footerWrapper.innerHTML = html;
                }
                
                // إنشاء تبويب الموبايل
                createMobileTabContent(html);

                                // 🆕 إعادة رسم الشريط بالكامل الآن بعد ضمان وجود #ticker-scroll
                // فعلياً بالـ DOM (يحل مشكلة توقيت السباق مع أول استدعاء مبكر)
                updateTickerHTML();

                // 🆕 [إصلاح]: عناصر البوابة (#ticker-expand-btn، #widgets-portal-modal،
                // #widgets-portal-overlay) موجودة داخل نفس ملف widgets-ticker.html الذي
                // تم حقنه للتو، لذلك نُهيّئ البوابة الآن مباشرة بعد ضمان وجودها فعلياً
                // بالـ DOM، بدل الاعتماد على setTimeout بمدة ثابتة كانت أحياناً تُنفَّذ
                // قبل اكتمال هذا الـ fetch (خصوصاً عند بطء الشبكة عند أول تحميل).
                setupPortalModal();

                // 🆕 تفعيل سحب/عجلة الفأرة على شريط المعلومات الفورية
                initTickerManualScroll();
            })
            .catch(err => {
                console.error('خطأ في تحميل الشريط المتحرك:', err);
            });
    }

    // ============================================
    // دالة إنشاء محتوى تبويب الموبايل (8 مجموعات كاملة)
    // ============================================
    function createMobileTabContent(html) {
        let tabContent = document.getElementById('widgets-content');
        if (!tabContent) {
            tabContent = document.createElement('div');
            tabContent.id = 'widgets-content';
            tabContent.className = 'panel-right panel-content';
            tabContent.style.display = 'none';
            document.body.appendChild(tabContent);
           
        }
        
        // تحميل محتوى البوابة الكاملة (8 مجموعات)
        fetch('/widgets-portal.html')
            .then(response => response.text())
            .then(portalHtml => {
                const container = document.createElement('div');
                container.innerHTML = portalHtml;
                
                const grid = container.querySelector('.widgets-portal-grid');
                if (!grid) return;
                
                                const clonedGrid = grid.cloneNode(true);
                // تسمية كل id بادئة mobile- لعزلها عن نسخة المودال الأصلية
                clonedGrid.querySelectorAll('[id]').forEach(function (el) {
                    el.id = 'mobile-' + el.id;
                });
                // 🆕 تحديث مربعات البحث المستنسخة لتُشير إلى معرّفات الشبكات الجديدة (mobile-)
                clonedGrid.querySelectorAll('[data-target-grid]').forEach(function (el) {
                    el.dataset.targetGrid = 'mobile-' + el.dataset.targetGrid;
                });
                
                tabContent.innerHTML = `
                    <div class="panel-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin: 0; font-size: 18px;"><i class="fas fa-chart-line"></i> التحديثات الفورية</h3>
                    </div>
                    <div class="panel-body widgets-tab-body" style="padding: 10px;"></div>
                `;
                                tabContent.querySelector('.widgets-tab-body').appendChild(clonedGrid);
                
                // تحديث البيانات في تبويب الموبايل
                updateMobilePortalData();
                updateMobilePortalTrafficList();
                updateMobilePortalFuelStatusList();
                updateLastUpdatedTimestamps();
                wireWidgetSearchInputs(tabContent); // 🆕
            })
            .catch(err => console.error('خطأ في تحميل محتوى البوابة للموبايل:', err));
    }
    // ============================================
    // دالة تحديث البيانات في تبويب الموبايل
    // ============================================
    function updateMobilePortalData() {
    renderManualGroupsInto('mobile-portal-');   // 🆕

    if (apiData.prayer) {
        Object.entries(apiData.prayer).forEach(([prayer, time]) => {
            const el = document.getElementById('mobile-portal-prayer-' + prayer);
            if (el) el.textContent = time;
        });
    }
    if (apiData.calendar) {
        Object.entries(apiData.calendar).forEach(([type, value]) => {
            const el = document.getElementById('mobile-portal-' + type + '-date');
            if (el) el.textContent = value;
        });
    }
}

    // ============================================
    // دالة إعداد البوابة التفصيلية (للكمبيوتر)
    // ============================================
        function setupPortalModal() {
        if (window.__widgetsPortalModalReady) return;

        const expandBtn = document.getElementById('ticker-expand-btn');
        const modal = document.getElementById('widgets-portal-modal');
        const overlay = document.getElementById('widgets-portal-overlay');
        const closeBtn = document.getElementById('portal-close-btn');
        const refreshBtn = document.getElementById('portal-refresh-btn');
        const contentArea = document.getElementById('portal-content-area');

        

                if (expandBtn && modal && overlay) {
                    window.__widgetsPortalModalReady = true;
            expandBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Expand button clicked');
                modal.classList.add('active');
                overlay.classList.add('active');
                loadPortalContent();
            });
        } else {
            console.error('Missing elements:', { expandBtn, modal, overlay });
        }

        // 🆕 فتح البوابة مباشرة عند بطاقة معينة (لزري "حالة الطرق" و"حالة
        // محطات الوقود" أعلى الخريطة، وأيضاً من تبويبة الرئيسية بالموبايل)
        window.openWidgetsPortalToCard = function (targetCardId) {
            if (modal && overlay) {
                modal.classList.add('active');
                overlay.classList.add('active');
            }
            loadPortalContent();
            setTimeout(function () {
                const targetEl = document.getElementById(targetCardId);
                if (targetEl && typeof targetEl.scrollIntoView === 'function') {
                    targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 400);
        };

        const roadStatusBtn = document.getElementById('btn-open-road-status');
        if (roadStatusBtn) {
            roadStatusBtn.addEventListener('click', function (e) {
                e.preventDefault();
                window.openWidgetsPortalToCard('portal-road-status-card');
            });
        }

        const fuelStatusBtn = document.getElementById('btn-open-fuel-status');
        if (fuelStatusBtn) {
            fuelStatusBtn.addEventListener('click', function (e) {
                e.preventDefault();
                window.openWidgetsPortalToCard('portal-fuel-status-card');
            });
        }

        if (closeBtn && modal && overlay) {
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked');
                modal.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Refresh button clicked');
                updateAllData();
                updatePortalData();
                
                refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';
                setTimeout(() => {
                    refreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> تحديث الكل';
                }, 1000);
            });
        }

        if (overlay && modal) {
            overlay.addEventListener('click', function(e) {
                e.stopPropagation();
                modal.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        if (modal) {
            modal.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    }

    // ============================================
    // دالة تحميل محتوى البوابة
    // ============================================
                function loadPortalContent() {
        const contentArea = document.getElementById('portal-content-area');
        if (!contentArea) return;

        fetch('/widgets-portal.html')
            .then(response => response.text())
            .then(html => {
                contentArea.innerHTML = html;
                updatePortalData();
                updatePortalTrafficList();
                updatePortalFuelStatusList();
                updateLastUpdatedTimestamps();
                wireWidgetSearchInputs(contentArea); // 🆕
            })
            .catch(err => {
                console.error('خطأ في تحميل محتوى البوابة:', err);
                contentArea.innerHTML = '<p>حدث خطأ في تحميل المحتوى</p>';
            });
    }

    // ============================================
    // دالة تحديث البيانات في البوابة
    // ============================================
    function updatePortalData() {
    renderManualGroupsInto('portal-');   // 🆕 يبني كل شيء ديناميكياً دفعة واحدة

    // البقية تبقى كما هي (prayer + calendar فقط):
    if (apiData.prayer) {
        Object.entries(apiData.prayer).forEach(([prayer, time]) => {
            const el = document.getElementById('portal-prayer-' + prayer);
            if (el) el.textContent = time;
        });
    }
    if (apiData.calendar) {
        Object.entries(apiData.calendar).forEach(([type, value]) => {
            const el = document.getElementById('portal-' + type + '-date');
            if (el) el.textContent = value;
        });
    }
}

    // ============================================
    // دالة بدء النظام
    // ============================================
        function init() {
        loadTickerHTML();
        
        // تحديث البيانات فوراً
        updateAllData();
        
        // تحديث الشريط المتحرك
        updateTickerHTML();
        
        // إعداد البوابة التفصيلية
        setTimeout(() => {
            setupPortalModal();
        }, 200);

        // 🆕 جلب حواجز الطرق ومحطات الوقود من الطبقات الحية أول مرة، ثم كل
        // دقيقة تلقائياً - هذا المصدر الوحيد الآن، لا حاجة لأي تعديل يدوي
        refreshLiveRoadBarriers();
        refreshLiveFuelStations();
        fetchRemoteWidgetsData();   // 🆕
        setInterval(refreshLiveRoadBarriers, 60000);
        setInterval(refreshLiveFuelStations, 60000);
        setInterval(fetchRemoteWidgetsData, 60000);   // 🆕
        
        // بدء التحديث التلقائي من APIs
        if (DISPLAY_CONFIG.autoUpdate) {
            Object.keys(API_CONFIG).forEach(type => {
                if (API_CONFIG[type].enabled) {
                    fetchFromAPI(type);
                    setInterval(() => fetchFromAPI(type), API_CONFIG[type].updateInterval);
                }
            });
        }
    }

    // ============================================
    // دالة بدء النظام عند تحميل الصفحة
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();