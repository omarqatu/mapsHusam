/**
 * Core Service Layer - طبقة مركزية للوظائف الأساسية
 * تخدم نسخة Desktop و Mobile معاً
 * تحتوي على: معالجة الإحداثيات، العمليات الحسابية، الوظائف المشتركة
 */

import API from './api.js';

// Cache للبيانات المحملة
const cache = {
    providerLinkedFeatures: {},
    platformStats: null
};

// معالجة الإحداثيات
export const CoordinateUtils = {
    /**
     * استخراج إحداثيات المعلم
     * @param {Object} feature - معلم OpenLayers
     * @returns {Array} [x, y] أو null
     */
    getFeatureCoords: (feature) => {
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
    
    /**
     * تحويل الإحداثيات إلى نص للمشاركة
     * @param {Array} coords - [x, y]
     * @returns {String} نص الإحداثيات
     */
    coordsToText: (coords) => {
        if (!coords || coords.length !== 2) return '';
        return `${coords[0].toFixed(6)}, ${coords[1].toFixed(6)}`;
    },
    
    /**
     * إنشاء رابط للموقع
     * @param {Array} coords - [x, y]
     * @returns {String} رابط الموقع
     */
    createLocationLink: (coords) => {
        if (!coords || coords.length !== 2) return '';
        return `${window.location.origin}?x=${coords[0]}&y=${coords[1]}`;
    }
};

// معالجة مزودي الخدمة المرتبطين
export const ProviderService = {
    /**
     * تحديث قائمة مزودي الخدمة المرتبطين
     */
    refreshLinkedFeatures: async () => {
        try {
            const data = await API.providers.getLinkedFeatures();
            if (data && data.success && data.linked) {
                const newCache = {};
                Object.keys(data.linked).forEach(layer => {
                    newCache[layer] = new Set((data.linked[layer] || []).map(id => String(id)));
                });
                cache.providerLinkedFeatures = newCache;
                return true;
            }
            return false;
        } catch (error) {
            console.warn('Failed to refresh provider linked features:', error);
            return false;
        }
    },
    
    /**
     * التحقق مما إذا كان المعلم مرتبط بمزود خدمة
     * @param {String} layerDbName - اسم الطبقة في قاعدة البيانات
     * @param {String|Number} featureId - معرف المعلم
     * @returns {Boolean}
     */
    isFeatureLinked: (layerDbName, featureId) => {
        if (!layerDbName || featureId === undefined || featureId === null || featureId === '') return false;
        const set = cache.providerLinkedFeatures[layerDbName];
        if (!set) return false;
        return set.has(String(featureId));
    },
    
    /**
     * الحصول على Cache الحالي
     */
    getCache: () => cache.providerLinkedFeatures
};

// معالجة إحصائيات المنصة
export const StatsService = {
    /**
     * جلب إحصائيات المنصة
     * @param {Boolean} forceRefresh - إجبار التحديث
     */
    getStats: async (forceRefresh = false) => {
        if (!forceRefresh && cache.platformStats) {
            return cache.platformStats;
        }
        
        try {
            const data = await API.stats.getPlatformStats();
            if (data && data.success && data.data) {
                cache.platformStats = data.data;
                return data.data;
            }
            return null;
        } catch (error) {
            console.warn('Failed to fetch platform stats:', error);
            return null;
        }
    },
    
    /**
     * تنسيق الأرقام
     * @param {Number} n - الرقم
     * @returns {String} الرقم منسق
     */
    formatNumber: (n) => {
        return Number(n || 0).toLocaleString();
    }
};

// معالجة التقييمات
export const RatingsService = {
    /**
     * جلب تقييمات معلم
     * @param {String} serviceLayer - اسم الطبقة
     * @param {String|Number} featureId - معرف المعلم
     */
    fetchFeatureRatings: async (serviceLayer, featureId) => {
        try {
            return await API.ratings.getFeatureRatings(serviceLayer, featureId);
        } catch (error) {
            console.warn('Failed to fetch feature ratings:', error);
            return null;
        }
    },
    
    /**
     * جلب التعليقات المعلقة
     * @param {Number} userId - معرف المستخدم
     */
    fetchPendingComments: async (userId) => {
        try {
            return await API.ratings.getPendingComments(userId);
        } catch (error) {
            console.warn('Failed to fetch pending comments:', error);
            return null;
        }
    }
};

// معالجة البحث
export const SearchService = {
    /**
     * البحث عن معالم
     * @param {Object} params - معاملات البحث
     */
    searchFeatures: async (params) => {
        try {
            return await API.search.searchFeatures(params);
        } catch (error) {
            console.warn('Failed to search features:', error);
            return null;
        }
    }
};

export default {
    CoordinateUtils,
    ProviderService,
    StatsService,
    RatingsService,
    SearchService
};
