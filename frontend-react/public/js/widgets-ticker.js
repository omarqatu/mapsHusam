/**
 * widgets-ticker.js
 * نظام العناصر الحيوية - إدارة البيانات والتحديثات
 * يدعم أسعار العملات، الذهب، الطقس، المحروقات، الصلاة، التقويم، الطرق، الأسواق
 *
 * 🆕 تعديل: حل مشكلة عدم ظهور البيانات داخل تبويبة "معلومات حية" على
 * الموبايل/التابلت، وتوحيد العنوان، وحذف زر الإغلاق غير اللازم لأنها
 * تبويبة ثابتة دائمة (راجع mobile-tabs.js).
 */

(function () {
    'use strict';

    // ============================================
    // إعدادات النظام
    // ============================================
    const CONFIG = {
        updateInterval: 60000, // تحديث كل دقيقة
        apiEndpoints: {
            currency: '/api/currency-rates',
            gold: '/api/gold-prices',
            weather: '/api/weather',
            fuel: '/api/fuel-prices',
            prayer: '/api/prayer-times',
            calendar: '/api/calendar',
            traffic: '/api/traffic',
            market: '/api/market-data'
        },
        palestinianCities: ['رام الله', 'غزة', 'القدس', 'نابلس', 'بيت لحم', 'الخليل']
    };

    // ============================================
    // البيانات المحلية (للتجربة)
    // ============================================
    let localData = {
        currency: {
            usd_ils: 3.45,
            jod_ils: 4.86,
            eur_ils: 3.72,
            gbp_ils: 4.38
        },
        gold: {
            gold_24: 215.5,
            gold_21: 188.5,
            gold_18: 161.5,
            gold_ounce: 2450
        },
        weather: {
            ramallah: { temp: 28, humidity: 65, wind: 12, condition: 'غائم جزئياً' },
            gaza: { temp: 32, humidity: 70, wind: 15, condition: 'مشمس' },
            jerusalem: { temp: 26, humidity: 60, wind: 10, condition: 'غائم' }
        },
        fuel: {
            benzine_95: 6.85,
            benzine_98: 7.05,
            diesel: 8.25,
            gas: 35.00
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
        },
        traffic: {
            qalandia: { status: 'ازدحام', delay: 15 },
            road60: { status: 'سلس', delay: 0 },
            checkpoint1: { status: 'طبيعي', delay: 5 }
        },
        market: {
            telaviv: { change: '+1.2%', value: 1850 },
            gold: { change: '+0.5%', value: 2450 },
            oil: { change: '-0.3%', value: 78.5 }
        }
    };

    // ============================================
    // 🆕 دالة موحّدة لتحديث القيمة في كل نسخ العنصر الموجودة بالصفحة
    // (النسخة الأصلية بالفوتر + نسخة تبويبة الموبايل التي تحمل بادئة mobile-)
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
    // دوال تحديث العناصر
    // ============================================

    // تحديث أسعار العملات
    function updateCurrencyRates() {
        fetchCurrencyData().then(data => {
            if (data) {
                localData.currency = data;
            }
            updateCurrencyUI();
        }).catch(err => {
            console.error('خطأ في تحديث أسعار العملات:', err);
            updateCurrencyUI(); // استخدام البيانات المحلية
        });
    }

    function fetchCurrencyData() {
        // محاكاة API - في الإنتاج استخدم fetch(CONFIG.apiEndpoints.currency)
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    usd_ils: (3.40 + Math.random() * 0.1).toFixed(3),
                    jod_ils: (4.80 + Math.random() * 0.1).toFixed(3),
                    eur_ils: (3.65 + Math.random() * 0.1).toFixed(3),
                    gbp_ils: (4.30 + Math.random() * 0.1).toFixed(3)
                });
            }, 500);
        });
    }

    function updateCurrencyUI() {
        setTickerValue('usd-ils', localData.currency.usd_ils);
        setTickerValue('jod-ils', localData.currency.jod_ils);
        setTickerValue('eur-ils', localData.currency.eur_ils);
        setTickerValue('gbp-ils', localData.currency.gbp_ils);
    }

    // تحديث أسعار الذهب
    function updateGoldPrices() {
        fetchGoldData().then(data => {
            if (data) {
                localData.gold = data;
            }
            updateGoldUI();
        }).catch(err => {
            console.error('خطأ في تحديث أسعار الذهب:', err);
            updateGoldUI();
        });
    }

    function fetchGoldData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    gold_24: (210 + Math.random() * 10).toFixed(1),
                    gold_21: (185 + Math.random() * 8).toFixed(1),
                    gold_18: (158 + Math.random() * 7).toFixed(1),
                    gold_ounce: (2440 + Math.random() * 20).toFixed(0)
                });
            }, 500);
        });
    }

    function updateGoldUI() {
    setTickerValue('gold-24', localData.gold.gold_24 + ' شيكل');
    setTickerValue('gold-21', localData.gold.gold_21 + ' شيكل');
    setTickerValue('gold-18', localData.gold.gold_18 + ' شيكل');
    setTickerValue('gold-ounce', '$' + localData.gold.gold_ounce);
}


    // تحديث الطقس
    function updateWeather() {
        fetchWeatherData().then(data => {
            if (data) {
                localData.weather = data;
            }
            updateWeatherUI();
        }).catch(err => {
            console.error('خطأ في تحديث الطقس:', err);
            updateWeatherUI();
        });
    }

    function fetchWeatherData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    ramallah: { temp: Math.floor(25 + Math.random() * 8), humidity: 60 + Math.floor(Math.random() * 15), condition: 'غائم جزئياً' },
                    gaza: { temp: Math.floor(28 + Math.random() * 8), humidity: 65 + Math.floor(Math.random() * 15), condition: 'مشمس' },
                    jerusalem: { temp: Math.floor(24 + Math.random() * 6), humidity: 55 + Math.floor(Math.random() * 15), condition: 'غائم' }
                });
            }, 500);
        });
    }

    function updateWeatherUI() {
        setTickerValue('weather-ramallah', localData.weather.ramallah.temp + '°C');
        setTickerValue('weather-gaza', localData.weather.gaza.temp + '°C');
        setTickerValue('weather-jerusalem', localData.weather.jerusalem.temp + '°C');
    }

    // تحديث أسعار المحروقات
    function updateFuelPrices() {
        fetchFuelData().then(data => {
            if (data) {
                localData.fuel = data;
            }
            updateFuelUI();
        }).catch(err => {
            console.error('خطأ في تحديث أسعار المحروقات:', err);
            updateFuelUI();
        });
    }

    function fetchFuelData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    benzine_95: (6.80 + Math.random() * 0.1).toFixed(2),
                    benzine_98: (7.00 + Math.random() * 0.1).toFixed(2),
                    diesel: (6.20 + Math.random() * 0.1).toFixed(2),
                    gas: 35.00
                });
            }, 500);
        });
    }

    function updateFuelUI() {
    setTickerValue('fuel-95', localData.fuel.benzine_95 + ' شيكل');
    setTickerValue('fuel-98', localData.fuel.benzine_98 + ' شيكل');
    setTickerValue('fuel-diesel', localData.fuel.diesel + ' شيكل');
    setTickerValue('fuel-gas', localData.fuel.gas + ' شيكل');
}

    // تحديث مواقيت الصلاة
    function updatePrayerTimes() {
        fetchPrayerData().then(data => {
            if (data) {
                localData.prayer = data;
            }
            updatePrayerUI();
        }).catch(err => {
            console.error('خطأ في تحديث مواقيت الصلاة:', err);
            updatePrayerUI();
        });
    }

    function fetchPrayerData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    fajr: '04:45',
                    dhuhr: '12:30',
                    asr: '15:45',
                    maghrib: '18:45',
                    isha: '20:15'
                });
            }, 500);
        });
    }

    function updatePrayerUI() {
    setTickerValue('prayer-fajr', localData.prayer.fajr);
    setTickerValue('prayer-dhuhr', localData.prayer.dhuhr);
    setTickerValue('prayer-asr', localData.prayer.asr);
    setTickerValue('prayer-maghrib', localData.prayer.maghrib);
    setTickerValue('prayer-isha', localData.prayer.isha);
}

    // تحديث التقويم
    function updateCalendar() {
        fetchCalendarData().then(data => {
            if (data) {
                localData.calendar = data;
            }
            updateCalendarUI();
        }).catch(err => {
            console.error('خطأ في تحديث التقويم:', err);
            updateCalendarUI();
        });
    }

    function fetchCalendarData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const today = new Date();
                resolve({
                    hijri: '12 رجب 1446',
                    gregorian: today.toISOString().split('T')[0],
                    events: []
                });
            }, 500);
        });
    }

    function updateCalendarUI() {
        setTickerValue('hijri-date', localData.calendar.hijri);
        setTickerValue('gregorian-date', localData.calendar.gregorian);
    }

    // تحديث حالة الطرق
    function updateTraffic() {
        fetchTrafficData().then(data => {
            if (data) {
                localData.traffic = data;
            }
            updateTrafficUI();
        }).catch(err => {
            console.error('خطأ في تحديث حالة الطرق:', err);
            updateTrafficUI();
        });
    }

    function fetchTrafficData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                const statuses = ['ازدحام', 'سلس', 'طبيعي'];
                resolve({
                    qalandia: { status: statuses[Math.floor(Math.random() * 3)], delay: Math.floor(Math.random() * 20) },
                    road60: { status: statuses[Math.floor(Math.random() * 3)], delay: Math.floor(Math.random() * 10) },
                    checkpoint1: { status: statuses[Math.floor(Math.random() * 3)], delay: Math.floor(Math.random() * 15) }
                });
            }, 500);
        });
    }

    function updateTrafficUI() {
        setTickerValue('traffic-qalandia', localData.traffic.qalandia.status);
        setTickerValue('traffic-road60', localData.traffic.road60.status);
    }

    // تحديث الأسواق
    function updateMarketData() {
        fetchMarketData().then(data => {
            if (data) {
                localData.market = data;
            }
            updateMarketUI();
        }).catch(err => {
            console.error('خطأ في تحديث الأسواق:', err);
            updateMarketUI();
        });
    }

    function fetchMarketData() {
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    telaviv: { change: (Math.random() * 2 - 1).toFixed(1) + '%', value: 1800 + Math.floor(Math.random() * 100) },
                    gold: { change: (Math.random() * 1 - 0.5).toFixed(1) + '%', value: 2440 + Math.floor(Math.random() * 20) },
                    oil: { change: (Math.random() * 1 - 0.5).toFixed(1) + '%', value: 78 + Math.random() * 2 }
                });
            }, 500);
        });
    }

    function updateMarketUI() {
        setTickerValue('market-telaviv', localData.market.telaviv.change);
        setTickerValue('market-gold', '$' + localData.market.gold.value);
    }

    // ============================================
    // تحديث جميع البيانات
    // ============================================
    function updateAllData() {
        updateCurrencyRates();
        updateGoldPrices();
        updateWeather();
        updateFuelPrices();
        updatePrayerTimes();
        updateCalendar();
        updateTraffic();
        updateMarketData();
    }

    // ============================================
    // إدارة البوابة التفصيلية
    // ============================================
    function setupPortalModal() {
        const expandBtn = document.getElementById('ticker-expand-btn');
        const modal = document.getElementById('widgets-portal-modal');
        const overlay = document.getElementById('widgets-portal-overlay');
        const closeBtn = document.getElementById('portal-close-btn');
        const refreshBtn = document.getElementById('portal-refresh-btn');
        const contentArea = document.getElementById('portal-content-area');

        console.log('Setting up portal modal:', { expandBtn, modal, overlay, closeBtn, refreshBtn });

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
                
                // إضافة تأثير بصري للزر
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

        // منع إغلاق البوابة عند النقر داخلها
        if (modal) {
            modal.addEventListener('click', function(e) {
                e.stopPropagation();
            });
        }
    }

    function loadPortalContent() {
        const contentArea = document.getElementById('portal-content-area');
        if (!contentArea) return;

        // تحميل محتوى البوابة من ملف منفصل
        fetch('/widgets-portal.html')
            .then(response => response.text())
            .then(html => {
                contentArea.innerHTML = html;
                initializePortalWidgets();
                setupPortalButtons();
            })
            .catch(err => {
                console.error('خطأ في تحميل محتوى البوابة:', err);
                contentArea.innerHTML = '<p>حدث خطأ في تحميل المحتوى</p>';
            });
    }

    function setupPortalButtons() {
        // إعداد أزرار التحديث والإغلاق بعد تحميل المحتوى
        const closeBtn = document.getElementById('portal-close-btn');
        const refreshBtn = document.getElementById('portal-refresh-btn');
        const modal = document.getElementById('widgets-portal-modal');
        const overlay = document.getElementById('widgets-portal-overlay');

        if (closeBtn && modal && overlay) {
            // إزالة المستمعين القديمة إذا وجدت
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Close button clicked (from loaded content)');
                modal.classList.remove('active');
                overlay.classList.remove('active');
            });
        }

        if (refreshBtn) {
            // إزالة المستمعين القديمة إذا وجدت
            const newRefreshBtn = refreshBtn.cloneNode(true);
            refreshBtn.parentNode.replaceChild(newRefreshBtn, refreshBtn);
            
            newRefreshBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('Refresh button clicked (from loaded content)');
                updateAllData();
                
                // إضافة تأثير بصري للزر
                newRefreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري التحديث...';
                setTimeout(() => {
                    newRefreshBtn.innerHTML = '<i class="fas fa-sync-alt"></i> تحديث الكل';
                }, 1000);
            });
        }
    }

    function initializePortalWidgets() {
        // تهيئة العناصر التفاعلية داخل البوابة
        console.log('تهيئة عناصر البوابة');
    }

    // ============================================
    // إدارة التبويبات للموبايل
    // ============================================
    function setupMobileTab() {
        // التحقق من وجود نظام التبويبات
        if (typeof window.mobileTabsSystem !== 'undefined') {
            // إضافة تبويبة المعلومات
            window.mobileTabsSystem.addTab({
                id: 'widgets-tab',
                label: '📊 معلومات',
                content: 'widgets-content',
                icon: 'fas fa-chart-line'
            });
        }
    }

    // ============================================
    // تهيئة النظام
    // ============================================
    function init() {
        // تحميل الشريط المتحرك
        loadTickerHTML();

        // تحديث البيانات الأولية
        updateAllData();

        // تحديث دوري
        setInterval(updateAllData, CONFIG.updateInterval);

        // إعداد التبويبات للموبايل
        if (window.innerWidth < 768) {
            setupMobileTab();
        }
    }

    function loadTickerHTML() {
        // تحميل HTML الشريط المتحرك
        fetch('/widgets-ticker.html')
            .then(response => response.text())
            .then(html => {
                const container = document.createElement('div');
                container.innerHTML = html;
                
                // إضافة المحتوى إلى الفوتر إذا وجد
                const footerWrapper = document.getElementById('widgets-ticker-wrapper');
                if (footerWrapper) {
                    footerWrapper.innerHTML = html;
                } else {
                    // إذا لم يوجد الفوتر، أضف للجسم
                    document.body.appendChild(container.firstElementChild);
                }
                
                // 🆕 بناء تبويبة "معلومات حية" من البوابة الكاملة (كل المجموعات الثمانية كاملة)
                buildMobileInfoTab();
                
                // تحديث فوري للنسخة المستنسخة داخل التبويبة بالبيانات الحالية
                // (لأن updateAllData() بالتهيئة الأولى قد يكون نُفّذ قبل أن
                // تُبنى نسخة الموبايل، فتفوتها أول جولة تحديث)
                updateAllData();

                // تأخير بسيط لضمان تحميل DOM
                setTimeout(() => {
                    setupPortalModal();
                }, 100);
            })
            .catch(err => {
                console.error('خطأ في تحميل الشريط المتحرك:', err);
            });
    }

    function loadTickerHTML() {
    fetch('/widgets-ticker.html')
        .then(response => response.text())
        .then(html => {
            const footerWrapper = document.getElementById('widgets-ticker-wrapper');
            if (footerWrapper) {
                footerWrapper.innerHTML = html;
            } else {
                const container = document.createElement('div');
                container.innerHTML = html;
                document.body.appendChild(container.firstElementChild);
            }

            // 🆕 تبويبة "معلومات حية" تُبنى من البوابة الكاملة (كل 8 المجموعات كاملة)
            buildMobileInfoTab();

            updateAllData();
            setTimeout(() => { setupPortalModal(); }, 100);
        })
        .catch(err => console.error('خطأ في تحميل الشريط المتحرك:', err));
}

function buildMobileInfoTab() {
    let tabContent = document.getElementById('widgets-content');
    if (!tabContent) {
        tabContent = document.createElement('div');
        tabContent.id = 'widgets-content';
        tabContent.className = 'panel-right panel-content';
        tabContent.style.display = 'none';
        document.body.appendChild(tabContent);
    }

    fetch('/widgets-portal.html')
        .then(response => response.text())
        .then(html => {
            const container = document.createElement('div');
            container.innerHTML = html;

            const grid = container.querySelector('.widgets-portal-grid');
            if (!grid) return;

            const clonedGrid = grid.cloneNode(true);
            // تسمية كل id بادئة mobile- لعزلها عن نسخة المودال الأصلية تماماً
            clonedGrid.querySelectorAll('[id]').forEach(function (el) {
                el.id = 'mobile-' + el.id;
            });
            // عمود واحد فقط داخل مساحة التبويبة الضيقة (بدون لمس CSS العام)
            clonedGrid.style.gridTemplateColumns = '1fr';
            clonedGrid.style.padding = '10px';
            clonedGrid.style.gap = '12px';

            tabContent.innerHTML = `
                <div class="panel-header" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #fff; padding: 15px 20px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 18px;"><i class="fas fa-chart-line"></i> معلومات حية</h3>
                </div>
                <div class="panel-body widgets-tab-body" style="padding: 0;"></div>
            `;
            tabContent.querySelector('.widgets-tab-body').appendChild(clonedGrid);
        })
        .catch(err => console.error('خطأ في تحميل تفاصيل معلومات حية:', err));
}

    // ============================================
    // بدء النظام عند تحميل الصفحة
    // ============================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ============================================
    // تصدير الوظائف للاستخدام الخارجي
    // ============================================
    window.WidgetsTicker = {
        updateAll: updateAllData,
        getData: () => localData,
        refresh: updateAllData
    };

})();