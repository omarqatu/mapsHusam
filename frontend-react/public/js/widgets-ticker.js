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
            ramallah: { temp: 28, humidity: 65, wind: 12, condition: 'غائم جزئياً' },
            gaza: { temp: 32, humidity: 70, wind: 15, condition: 'مشمس' },
            jerusalem: { temp: 26, humidity: 60, wind: 10, condition: 'غائم' }
        },
        prayer: {
            fajr: '04:45',
            dhuhr: '12:30',
            asr: '15:45',
            maghrib: '18:45',
            isha: '20:15'
        },
        calendar: {
            hijri: '12 رجب 1446',
            gregorian: '2026-08-17',
            events: []
        }
    };

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
                    <span style="color:${diesel.color};">${diesel.icon} ديزل</span>
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
            })
            .catch(err => console.error('خطأ في تحميل محتوى البوابة للموبايل:', err));
    }

    // ============================================
    // دالة تحديث البيانات في تبويب الموبايل
    // ============================================
    function updateMobilePortalData() {
        // تحديث البيانات اليدوية
        if (MANUAL_DATA.currency) {
            MANUAL_DATA.currency.forEach(c => {
                const el = document.getElementById('mobile-portal-' + c.id);
                if (el) el.textContent = c.value;
            });
        }
        if (MANUAL_DATA.gold) {
            MANUAL_DATA.gold.forEach(g => {
                const el = document.getElementById('mobile-portal-' + g.id);
                if (el) el.textContent = g.value;
            });
        }
        if (MANUAL_DATA.fuel) {
            MANUAL_DATA.fuel.forEach(f => {
                const el = document.getElementById('mobile-portal-' + f.id);
                if (el) el.textContent = f.value;
            });
        }
        if (MANUAL_DATA.traffic) {
            MANUAL_DATA.traffic.forEach(t => {
                const el = document.getElementById('mobile-portal-' + t.id);
                if (el) {
                    el.innerHTML = `<i class="fas ${TRAFFIC_ICONS[t.status]}" style="color: ${TRAFFIC_COLORS[t.status]}"></i>`;
                }
            });
        }
        if (MANUAL_DATA.transport_inter_city) {
            MANUAL_DATA.transport_inter_city.forEach(t => {
                const el = document.getElementById('mobile-portal-' + t.id);
                if (el) el.textContent = t.value;
            });
        }
        if (MANUAL_DATA.transport_intra_city) {
            MANUAL_DATA.transport_intra_city.forEach(t => {
                const el = document.getElementById('mobile-portal-' + t.id);
                if (el) el.textContent = t.value;
            });
        }
        if (MANUAL_DATA.events) {
            MANUAL_DATA.events.forEach(e => {
                const el = document.getElementById('mobile-portal-' + e.id);
                if (el) el.textContent = e.date;
            });
        }

        // تحديث البيانات من APIs
        if (apiData.weather) {
            Object.entries(apiData.weather).forEach(([city, data]) => {
                const el = document.getElementById('mobile-portal-weather-' + city);
                if (el) el.textContent = data.temp + '°C';
            });
        }
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
        const expandBtn = document.getElementById('ticker-expand-btn');
        const modal = document.getElementById('widgets-portal-modal');
        const overlay = document.getElementById('widgets-portal-overlay');
        const closeBtn = document.getElementById('portal-close-btn');
        const refreshBtn = document.getElementById('portal-refresh-btn');
        const contentArea = document.getElementById('portal-content-area');

        

                if (expandBtn && modal && overlay) {
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
        // تحديث البيانات اليدوية
        if (MANUAL_DATA.currency) {
            MANUAL_DATA.currency.forEach(c => {
                const el = document.getElementById('portal-' + c.id);
                if (el) el.textContent = c.value;
            });
        }
        if (MANUAL_DATA.gold) {
            MANUAL_DATA.gold.forEach(g => {
                const el = document.getElementById('portal-' + g.id);
                if (el) el.textContent = g.value;
            });
        }
        if (MANUAL_DATA.fuel) {
            MANUAL_DATA.fuel.forEach(f => {
                const el = document.getElementById('portal-' + f.id);
                if (el) el.textContent = f.value;
            });
        }
        if (MANUAL_DATA.traffic) {
            MANUAL_DATA.traffic.forEach(t => {
                const el = document.getElementById('portal-' + t.id);
                if (el) {
                    el.innerHTML = `<i class="fas ${TRAFFIC_ICONS[t.status]}" style="color: ${TRAFFIC_COLORS[t.status]}"></i>`;
                }
            });
        }
        if (MANUAL_DATA.transport_inter_city) {
            MANUAL_DATA.transport_inter_city.forEach(t => {
                const el = document.getElementById('portal-' + t.id);
                if (el) el.textContent = t.value;
            });
        }
        if (MANUAL_DATA.transport_intra_city) {
            MANUAL_DATA.transport_intra_city.forEach(t => {
                const el = document.getElementById('portal-' + t.id);
                if (el) el.textContent = t.value;
            });
        }
        if (MANUAL_DATA.events) {
            MANUAL_DATA.events.forEach(e => {
                const el = document.getElementById('portal-' + e.id);
                if (el) el.textContent = e.date;
            });
        }

        // تحديث البيانات من APIs
        if (apiData.weather) {
            Object.entries(apiData.weather).forEach(([city, data]) => {
                const el = document.getElementById('portal-weather-' + city);
                if (el) el.textContent = data.temp + '°C';
            });
        }
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
        setInterval(refreshLiveRoadBarriers, 60000);
        setInterval(refreshLiveFuelStations, 60000);
        
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