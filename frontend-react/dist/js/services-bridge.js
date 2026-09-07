/**
 * Services Bridge - جسر ربط ملفات public/ بالخدمات الجديدة
 * يسمح بالاستمرار في التعديل على ملفات public/ كما اعتادت،
 * مع ربطها برمجياً بالخدمات المركزية
 * 
 * هذا الملف يتم تحميله قبل جميع ملفات JS الأخرى في public/
 */

// تعريف كائن عالمي للخدمات
window.AppServices = {
    // API Calls
    API: {
        ratings: {
            getFeatureRatings: async (serviceLayer, featureId) => {
                // استخدام الخدمة الجديدة إذا كانت متاحة
                if (window.CoreService && window.CoreService.RatingsService) {
                    return window.CoreService.RatingsService.fetchFeatureRatings(serviceLayer, featureId);
                }
                // الفallback للكود القديم
                const response = await fetch(`${window.location.origin}/api/service-ratings?service_layer=${serviceLayer}&feature_id=${featureId}`);
                return await response.json();
            },
            
            getPendingComments: async (userId) => {
                if (window.CoreService && window.CoreService.RatingsService) {
                    return window.CoreService.RatingsService.fetchPendingComments(userId);
                }
                const response = await fetch(`${window.location.origin}/api/service-ratings/pending-comments?user_id=${userId}`);
                return await response.json();
            }
        },
        
        providers: {
            getLinkedFeatures: async () => {
                if (window.CoreService && window.CoreService.ProviderService) {
                    await window.CoreService.ProviderService.refreshLinkedFeatures();
                    return window.CoreService.ProviderService.getCache();
                }
                const response = await fetch(`${window.location.origin}/api/provider-linked-features`);
                return await response.json();
            }
        },
        
        stats: {
            getPlatformStats: async () => {
                if (window.CoreService && window.CoreService.StatsService) {
                    return window.CoreService.StatsService.getStats();
                }
                const response = await fetch(`${window.location.origin}/api/platform-stats`);
                return await response.json();
            }
        },
        
        search: {
            searchFeatures: async (params) => {
                if (window.CoreService && window.CoreService.SearchService) {
                    return window.CoreService.SearchService.searchFeatures(params);
                }
                const queryString = new URLSearchParams(params).toString();
                const response = await fetch(`${window.location.origin}/api/search-features?${queryString}`);
                return await response.json();
            }
        }
    },
    
    // Coordinate Utils
    CoordinateUtils: {
        getFeatureCoords: (feature) => {
            if (window.CoreService && window.CoreService.CoordinateUtils) {
                return window.CoreService.CoordinateUtils.getFeatureCoords(feature);
            }
            // Fallback للكود القديم
            try {
                const geom = feature.getGeometry();
                if (!geom) return null;
                const geomType = geom.getType();
                if (geomType === 'Point') {
                    return geom.getCoordinates();
                } else if (geomType.includes('Line') || geomType.includes('Polygon')) {
                    return geom.getCenter ? geom.getCenter() : geom.getInteriorPoint().getCoordinates();
                }
                return null;
            } catch (error) {
                console.error('Error getting feature coordinates:', error);
                return null;
            }
        },
        
        coordsToText: (coords) => {
            if (window.CoreService && window.CoreService.CoordinateUtils) {
                return window.CoreService.CoordinateUtils.coordsToText(coords);
            }
            if (!coords || coords.length !== 2) return '';
            return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
        },
        
        createLocationLink: (coords) => {
            if (window.CoreService && window.CoreService.CoordinateUtils) {
                return window.CoreService.CoordinateUtils.createLocationLink(coords);
            }
            if (!coords || coords.length !== 2) return '';
            return `${window.location.origin}?x=${coords[0]}&y=${coords[1]}`;
        }
    },
    
    // Provider Service
    ProviderService: {
        refreshLinkedFeatures: async () => {
            if (window.CoreService && window.CoreService.ProviderService) {
                return window.CoreService.ProviderService.refreshLinkedFeatures();
            }
            // Fallback للكود القديم
            try {
                const res = await fetch(window.location.origin + '/api/provider-linked-features');
                const data = await res.json();
                if (data && data.success && data.linked) {
                    const newCache = {};
                    Object.keys(data.linked).forEach(layer => {
                        newCache[layer] = new Set((data.linked[layer] || []).map(id => String(id)));
                    });
                    window.providerLinkedFeaturesCache = newCache;
                    return true;
                }
                return false;
            } catch (e) {
                console.warn('تعذر تحديث قائمة مزودي الخدمة المرتبطين:', e.message);
                return false;
            }
        },
        
        isFeatureLinked: (layerDbName, featureId) => {
            if (window.CoreService && window.CoreService.ProviderService) {
                return window.CoreService.ProviderService.isFeatureLinked(layerDbName, featureId);
            }
            // Fallback للكود القديم
            if (!layerDbName || featureId === undefined || featureId === null || featureId === '') return false;
            const set = window.providerLinkedFeaturesCache[layerDbName];
            if (!set) return false;
            return set.has(String(featureId));
        }
    },
    
    // Stats Service
    StatsService: {
        getStats: async (forceRefresh = false) => {
            if (window.CoreService && window.CoreService.StatsService) {
                return window.CoreService.StatsService.getStats(forceRefresh);
            }
            // Fallback للكود القديم
            try {
                const res = await fetch(window.location.origin + '/api/platform-stats');
                const json = await res.json();
                if (json && json.success && json.data) {
                    return json.data;
                }
                return null;
            } catch (err) {
                console.warn('تعذر جلب إحصائيات المنصة:', err.message);
                return null;
            }
        },
        
        formatNumber: (n) => {
            if (window.CoreService && window.CoreService.StatsService) {
                return window.CoreService.StatsService.formatNumber(n);
            }
            return Number(n || 0).toLocaleString();
        }
    },
    
    // String Utils
    StringUtils: {
        sanitizeHTML: (str) => {
            if (window.StringUtils) {
                return window.StringUtils.sanitizeHTML(str);
            }
            if (!str) return "";
            const temp = document.createElement('div');
            temp.textContent = str;
            return temp.innerHTML;
        },
        
        escapeForAttribute: (str) => {
            if (window.StringUtils) {
                return window.StringUtils.escapeForAttribute(str);
            }
            if (!str) return '';
            return str
                .replace(/&/g, '&amp;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },
        
        formatCurrency: (amount, currency = 'USD') => {
            if (window.StringUtils) {
                return window.StringUtils.formatCurrency(amount, currency);
            }
            const symbols = {
                'USD': '$',
                'ILS': '₪',
                'JOD': 'د.أ',
                'EUR': '€'
            };
            const symbol = symbols[currency] || currency;
            return `${symbol} ${Number(amount || 0).toLocaleString()}`;
        }
    },
    
    // Time Utils
    TimeUtils: {
        parseArabicTime: (arabicTime) => {
            if (window.TimeUtils) {
                return window.TimeUtils.parseArabicTime(arabicTime);
            }
            // Fallback للكود القديم
            if (!arabicTime) return null;
            
            const arabicToEnglish = {
                '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
                '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
            };
            
            let englishTime = arabicTime;
            Object.keys(arabicToEnglish).forEach(arabic => {
                englishTime = englishTime.replace(new RegExp(arabic, 'g'), arabicToEnglish[arabic]);
            });
            
            const isPM = englishTime.includes('م') || englishTime.toLowerCase().includes('pm');
            const timePart = englishTime.replace(/[صمPM]/g, '').trim();
            const [hours, minutes] = timePart.split(':').map(Number);
            
            if (isNaN(hours) || isNaN(minutes)) return null;
            
            let hour24 = hours;
            if (isPM && hours !== 12) hour24 += 12;
            if (!isPM && hours === 12) hour24 = 0;
            
            const now = new Date();
            return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour24, minutes);
        },
        
        formatWorkHours: (openTime, closeTime) => {
            if (window.TimeUtils) {
                return window.TimeUtils.formatWorkHours(openTime, closeTime);
            }
            if (!openTime || !closeTime) return 'غير محدد';
            return `${openTime} - ${closeTime}`;
        },
        
        getServiceStatus: (openTime, closeTime) => {
            if (window.TimeUtils) {
                return window.TimeUtils.getServiceStatus(openTime, closeTime);
            }
            // Fallback للكود القديم
            const now = new Date();
            const open = window.TimeUtils ? window.TimeUtils.parseArabicTime(openTime) : null;
            const close = window.TimeUtils ? window.TimeUtils.parseArabicTime(closeTime) : null;
            
            if (!open || !close) {
                return { isOpen: false, status: 'غير محدد', statusClass: 'unknown' };
            }
            
            if (now >= open && now <= close) {
                return { isOpen: true, status: 'مفتوح الآن', statusClass: 'open' };
            } else {
                return { isOpen: false, status: 'مغلق الآن', statusClass: 'closed' };
            }
        }
    },
    
    // URL Utils
    URLUtils: {
        cleanURL: (url) => {
            if (window.URLUtils) {
                return window.URLUtils.cleanURL(url);
            }
            if (!url) return '';
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                return 'https://' + url;
            }
            return url;
        },
        
        copyLocationLink: async (coords) => {
            if (window.URLUtils) {
                return window.URLUtils.copyLocationLink(coords);
            }
            if (!coords || coords.length !== 2) return false;
            
            const link = `${window.location.origin}?x=${coords[0]}&y=${coords[1]}`;
            
            try {
                await navigator.clipboard.writeText(link);
                return true;
            } catch (err) {
                console.error('Failed to copy link:', err);
                return false;
            }
        }
    },
    
    // Device Utils
    DeviceUtils: {
        getDeviceType: () => {
            if (window.DeviceUtils) {
                return window.DeviceUtils.getDeviceType();
            }
            const width = window.innerWidth;
            if (width < 768) return 'mobile';
            if (width < 1024) return 'tablet';
            return 'desktop';
        },
        
        isMobile: () => {
            if (window.DeviceUtils) {
                return window.DeviceUtils.isMobile();
            }
            return window.innerWidth < 768;
        },
        
        isTablet: () => {
            if (window.DeviceUtils) {
                return window.DeviceUtils.isTablet();
            }
            return window.innerWidth >= 768 && window.innerWidth < 1024;
        },
        
        isDesktop: () => {
            if (window.DeviceUtils) {
                return window.DeviceUtils.isDesktop();
            }
            return window.innerWidth >= 1024;
        }
    },
    
    // Mobile Services
    MobileService: {
        TabService: {
            getTabs: () => {
                if (window.MobileService && window.MobileService.TabService) {
                    return window.MobileService.TabService.getTabs();
                }
                return [
                    { id: ' map', icon: '🗺️', label: 'الخريطة' },
                    { id: 'search', icon: '🔍', label: 'البحث' },
                    { id: 'favorites', icon: '⭐', label: 'المفضلة' },
                    { id: 'profile', icon: '👤', label: 'الملف' }
                ];
            },
            
            getActiveTab: () => {
                if (window.MobileService && window.MobileService.TabService) {
                    return window.MobileService.TabService.getActiveTab();
                }
                return localStorage.getItem('mobile_active_tab') || 'map';
            },
            
            setActiveTab: (tabId) => {
                if (window.MobileService && window.MobileService.TabService) {
                    window.MobileService.TabService.setActiveTab(tabId);
                }
                localStorage.setItem('mobile_active_tab', tabId);
            },
            
            isTabActive: (tabId) => {
                if (window.MobileService && window.MobileService.TabService) {
                    return window.MobileService.TabService.isTabActive(tabId);
                }
                return localStorage.getItem('mobile_active_tab') === tabId;
            }
        },
        
        NavigationService: {
            navigateTo: (page, params = {}) => {
                if (window.MobileService && window.MobileService.NavigationService) {
                    window.MobileService.NavigationService.navigateTo(page, params);
                }
                const url = new URL(window.location.href);
                url.searchParams.set('page', page);
                Object.keys(params).forEach(key => {
                    url.searchParams.set(key, params[key]);
                });
                window.location.href = url.toString();
            },
            
            goBack: () => {
                if (window.MobileService && window.MobileService.NavigationService) {
                    window.MobileService.NavigationService.goBack();
                }
                window.history.back();
            },
            
            getCurrentPage: () => {
                if (window.MobileService && window.MobileService.NavigationService) {
                    return window.MobileService.NavigationService.getCurrentPage();
                }
                const params = new URLSearchParams(window.location.search);
                return params.get('page') || 'map';
            }
        },
        
        MobileModeService: {
            enableMobileMode: () => {
                if (window.MobileService && window.MobileService.MobileModeService) {
                    window.MobileService.MobileModeService.enableMobileMode();
                }
                document.body.classList.add('mobile-mode');
                localStorage.setItem('mobile_mode', 'enabled');
            },
            
            disableMobileMode: () => {
                if (window.MobileService && window.MobileService.MobileModeService) {
                    window.MobileService.MobileModeService.disableMobileMode();
                }
                document.body.classList.remove('mobile-mode');
                localStorage.setItem('mobile_mode', 'disabled');
            },
            
            isMobileModeEnabled: () => {
                if (window.MobileService && window.MobileService.MobileModeService) {
                    return window.MobileService.MobileModeService.isMobileModeEnabled();
                }
                return localStorage.getItem('mobile_mode') === 'enabled' || window.innerWidth < 768;
            },
            
            toggleMobileMode: () => {
                if (window.MobileService && window.MobileService.MobileModeService) {
                    window.MobileService.MobileModeService.toggleMobileMode();
                }
                const isEnabled = localStorage.getItem('mobile_mode') === 'enabled';
                if (isEnabled) {
                    document.body.classList.remove('mobile-mode');
                    localStorage.setItem('mobile_mode', 'disabled');
                } else {
                    document.body.classList.add('mobile-mode');
                    localStorage.setItem('mobile_mode', 'enabled');
                }
            }
        }
    }
};

// تصدير للخدمات الجديدة إذا كانت متاحة (للاستخدام في React)
window.CoreService = window.CoreService || null;
window.StringUtils = window.StringUtils || null;
window.TimeUtils = window.TimeUtils || null;
window.URLUtils = window.URLUtils || null;
window.DeviceUtils = window.DeviceUtils || null;
window.MobileService = window.MobileService || null;


