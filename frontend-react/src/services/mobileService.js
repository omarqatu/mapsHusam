/**
 * Mobile Service Layer - طبقة مخصصة للموبايل
 * تحتوي على وظائف خاصة بالموبايل مثل التبويبات، التنقل، إلخ
 */

import { DeviceUtils } from '../utils/helpers.js';

// إعدادات الموبايل
const MOBILE_CONFIG = {
    tabs: [
        { id: 'map', icon: '🗺️', label: 'الخريطة' },
        { id: 'search', icon: '🔍', label: 'البحث' },
        { id: 'favorites', icon: '⭐', label: 'المفضلة' },
        { id: 'profile', icon: '👤', label: 'الملف' }
    ],
    bottomNavHeight: 60,
    headerHeight: 50
};

// إدارة التبويبات
export const TabService = {
    /**
     * الحصول على التبويبات المتاحة
     * @returns {Array} قائمة التبويبات
     */
    getTabs: () => {
        return MOBILE_CONFIG.tabs;
    },
    
    /**
     * الحصول على التبويب النشط
     * @returns {String} معرف التبويب النشط
     */
    getActiveTab: () => {
        return localStorage.getItem('mobile_active_tab') || 'map';
    },
    
    /**
     * تعيين التبويب النشط
     * @param {String} tabId - معرف التبويب
     */
    setActiveTab: (tabId) => {
        localStorage.setItem('mobile_active_tab', tabId);
    },
    
    /**
     * التحقق من هل التبويب نشط
     * @param {String} tabId - معرف التبويب
     * @returns {Boolean}
     */
    isTabActive: (tabId) => {
        return TabService.getActiveTab() === tabId;
    }
};

// إدارة التنقل
export const NavigationService = {
    /**
     * الانتقال إلى صفحة
     * @param {String} page - اسم الصفحة
     * @param {Object} params - معاملات إضافية
     */
    navigateTo: (page, params = {}) => {
        const url = new URL(window.location.href);
        url.searchParams.set('page', page);
        
        Object.keys(params).forEach(key => {
            url.searchParams.set(key, params[key]);
        });
        
        window.location.href = url.toString();
    },
    
    /**
     * العودة للخلف
     */
    goBack: () => {
        window.history.back();
    },
    
    /**
     * الحصول على الصفحة الحالية
     * @returns {String} اسم الصفحة
     */
    getCurrentPage: () => {
        const params = new URLSearchParams(window.location.search);
        return params.get('page') || 'map';
    }
};

// إدارة اللمس والإيماءات
export const GestureService = {
    /**
     * إعداد معالجات الإيماءات
     * @param {HTMLElement} element - العنصر
     * @param {Object} handlers - معالجات الإيماءات
     */
    setupGestures: (element, handlers = {}) => {
        if (!element) return;
        
        let startX, startY;
        const threshold = 50; // حد السحب
        
        element.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });
        
        element.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;
            
            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;
            
            const diffX = endX - startX;
            const diffY = endY - startY;
            
            // سحب أفقي
            if (Math.abs(diffX) > Math.abs(diffY)) {
                if (Math.abs(diffX) > threshold) {
                    if (diffX > 0 && handlers.onSwipeRight) {
                        handlers.onSwipeRight();
                    } else if (diffX < 0 && handlers.onSwipeLeft) {
                        handlers.onSwipeLeft();
                    }
                }
            }
            // سحب عمودي
            else {
                if (Math.abs(diffY) > threshold) {
                    if (diffY > 0 && handlers.onSwipeDown) {
                        handlers.onSwipeDown();
                    } else if (diffY < 0 && handlers.onSwipeUp) {
                        handlers.onSwipeUp();
                    }
                }
            }
            
            startX = null;
            startY = null;
        });
    }
};

// إدارة شاشة الموبايل
export const MobileScreenService = {
    /**
     * الحصول على ارتفاع الشاشة المتاح
     * @returns {Number} الارتفاع بالبكسل
     */
    getAvailableHeight: () => {
        const headerHeight = MOBILE_CONFIG.headerHeight;
        const bottomNavHeight = MOBILE_CONFIG.bottomNavHeight;
        const windowHeight = window.innerHeight;
        
        return windowHeight - headerHeight - bottomNavHeight;
    },
    
    /**
     * الحصول على عرض الشاشة المتاح
     * @returns {Number} العرض بالبكسل
     */
    getAvailableWidth: () => {
        return window.innerWidth;
    },
    
    /**
     * التحقق من هل الجهاز في وضع عمودي
     * @returns {Boolean}
     */
    isPortrait: () => {
        return window.innerHeight > window.innerWidth;
    },
    
    /**
     * التحقق من هل الجهاز في وضع أفقي
     * @returns {Boolean}
     */
    isLandscape: () => {
        return window.innerWidth > window.innerHeight;
    }
};

// إدارة وضع الموبايل
export const MobileModeService = {
    /**
     * تفعيل وضع الموبايل
     */
    enableMobileMode: () => {
        document.body.classList.add('mobile-mode');
        localStorage.setItem('mobile_mode', 'enabled');
    },
    
    /**
     * تعطيل وضع الموبايل
     */
    disableMobileMode: () => {
        document.body.classList.remove('mobile-mode');
        localStorage.setItem('mobile_mode', 'disabled');
    },
    
    /**
     * التحقق من هل وضع الموبايل مفعّل
     * @returns {Boolean}
     */
    isMobileModeEnabled: () => {
        return localStorage.getItem('mobile_mode') === 'enabled' || DeviceUtils.isMobile();
    },
    
    /**
     * التبديل بين وضع الموبايل والحاسوب
     */
    toggleMobileMode: () => {
        if (MobileModeService.isMobileModeEnabled()) {
            MobileModeService.disableMobileMode();
        } else {
            MobileModeService.enableMobileMode();
        }
    }
};

export default {
    TabService,
    NavigationService,
    GestureService,
    MobileScreenService,
    MobileModeService
};
