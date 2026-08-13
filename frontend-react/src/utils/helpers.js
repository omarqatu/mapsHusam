/**
 * Utility Functions - دوال مساعدة موحدة
 * تخدم نسخة Desktop و Mobile معاً
 */

// معالجة النصوص
export const StringUtils = {
    /**
     * تطهير النصوص من XSS
     * @param {String} str - النص
     * @returns {String} النص المطهر
     */
    sanitizeHTML: (str) => {
        if (!str) return "";
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },
    
    /**
     * الهروب من خصائص HTML
     * @param {String} str - النص
     * @returns {String} النص المهرب
     */
    escapeForAttribute: (str) => {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
    
    /**
     * تنسيق العملة
     * @param {Number} amount - المبلغ
     * @param {String} currency - العملة
     * @returns {String} المبلغ منسق
     */
    formatCurrency: (amount, currency = 'USD') => {
        const symbols = {
            'USD': '$',
            'ILS': '₪',
            'JOD': 'د.أ',
            'EUR': '€'
        };
        const symbol = symbols[currency] || currency;
        return `${symbol} ${Number(amount || 0).toLocaleString()}`;
    }
};

// معالجة الوقت
export const TimeUtils = {
    /**
     * تحويل الوقت العربي إلى كائن Date
     * @param {String} arabicTime - الوقت بالصيغة العربية (مثال: "٩:٠٠ ص")
     * @returns {Date|null}
     */
    parseArabicTime: (arabicTime) => {
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
    
    /**
     * تنسيق ساعات العمل
     * @param {String} openTime - وقت الفتح
     * @param {String} closeTime - وقت الإغلاق
     * @returns {String} ساعات العمل منسقة
     */
    formatWorkHours: (openTime, closeTime) => {
        if (!openTime || !closeTime) return 'غير محدد';
        return `${openTime} - ${closeTime}`;
    },
    
    /**
     * التحقق من حالة الخدمة (مفتوح/مغلق)
     * @param {String} openTime - وقت الفتح
     * @param {String} closeTime - وقت الإغلاق
     * @returns {Object} { isOpen, status, statusClass }
     */
    getServiceStatus: (openTime, closeTime) => {
        const now = new Date();
        const open = TimeUtils.parseArabicTime(openTime);
        const close = TimeUtils.parseArabicTime(closeTime);
        
        if (!open || !close) {
            return { isOpen: false, status: 'غير محدد', statusClass: 'unknown' };
        }
        
        if (now >= open && now <= close) {
            return { isOpen: true, status: 'مفتوح الآن', statusClass: 'open' };
        } else {
            return { isOpen: false, status: 'مغلق الآن', statusClass: 'closed' };
        }
    }
};

// معالجة الروابط
export const URLUtils = {
    /**
     * تنظيف الرابط
     * @param {String} url - الرابط
     * @returns {String} الرابط المنظف
     */
    cleanURL: (url) => {
        if (!url) return '';
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            return 'https://' + url;
        }
        return url;
    },
    
    /**
     * نسخ رابط الموقع للحافظة
     * @param {Array} coords - الإحداثيات [x, y]
     * @returns {Promise<Boolean>}
     */
    copyLocationLink: async (coords) => {
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
};

// معالجة الأجهزة
export const DeviceUtils = {
    /**
     * التحقق من نوع الجهاز
     * @returns {String} 'mobile' | 'tablet' | 'desktop'
     */
    getDeviceType: () => {
        const width = window.innerWidth;
        
        if (width < 768) return 'mobile';
        if (width < 1024) return 'tablet';
        return 'desktop';
    },
    
    /**
     * التحقق من هل الجهاز موبايل
     * @returns {Boolean}
     */
    isMobile: () => {
        return DeviceUtils.getDeviceType() === 'mobile';
    },
    
    /**
     * التحقق من هل الجهاز تابلت
     * @returns {Boolean}
     */
    isTablet: () => {
        return DeviceUtils.getDeviceType() === 'tablet';
    },
    
    /**
     * التحقق من هل الجهاز حاسوب
     * @returns {Boolean}
     */
    isDesktop: () => {
        return DeviceUtils.getDeviceType() === 'desktop';
    }
};

// معالجة الأخطاء
export const ErrorUtils = {
    /**
     * معالجة خطأ API
     * @param {Error} error - الخطأ
     * @returns {String} رسالة الخطأ منسقة
     */
    handleApiError: (error) => {
        if (error.response) {
            // خطأ من السيرفر
            return `خطأ في السيرفر: ${error.response.status}`;
        } else if (error.request) {
            // لا يوجد استجابة
            return 'لا يمكن الاتصال بالسيرفر';
        } else {
            // خطأ آخر
            return error.message || 'حدث خطأ غير معروف';
        }
    },
    
    /**
     * عرض رسالة خطأ للمستخدم
     * @param {String} message - الرسالة
     * @param {String} type - النوع 'error' | 'warning' | 'info'
     */
    showError: (message, type = 'error') => {
        if (window.toast) {
            window.toast(message, type);
        } else {
            alert(message);
        }
    }
};

export default {
    StringUtils,
    TimeUtils,
    URLUtils,
    DeviceUtils,
    ErrorUtils
};
