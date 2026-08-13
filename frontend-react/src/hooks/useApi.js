/**
 * Custom Hooks - Hooks موحدة للاستخدام في Desktop و Mobile
 * تخدم نسخة Desktop و Mobile معاً
 */

import { useState, useEffect, useCallback } from 'react';
import API from '../services/api.js';

/**
 * Hook لجلب البيانات مع retry mechanism
 * @param {Function} apiCall - دالة API
 * @param {Array} deps - الاعتماديات
 * @param {Object} options - خيارات إضافية { enabled, retryCount }
 */
export const useApi = (apiCall, deps = [], options = {}) => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    
    const { enabled = true, retryCount = 3 } = options;
    
    const fetchData = useCallback(async () => {
        if (!enabled) return;
        
        setLoading(true);
        setError(null);
        
        try {
            const result = await apiCall();
            setData(result);
        } catch (err) {
            setError(err);
            console.error('API Error:', err);
        } finally {
            setLoading(false);
        }
    }, [apiCall, enabled]);
    
    useEffect(() => {
        fetchData();
    }, deps);
    
    return { data, loading, error, refetch: fetchData };
};

/**
 * Hook لجلب التقييمات
 * @param {String} serviceLayer - اسم الطبقة
 * @param {String|Number} featureId - معرف المعلم
 */
export const useRatings = (serviceLayer, featureId) => {
    return useApi(
        () => API.ratings.getFeatureRatings(serviceLayer, featureId),
        [serviceLayer, featureId],
        { enabled: !!serviceLayer && !!featureId }
    );
};

/**
 * Hook لجلب التعليقات المعلقة
 * @param {Number} userId - معرف المستخدم
 */
export const usePendingComments = (userId) => {
    return useApi(
        () => API.ratings.getPendingComments(userId),
        [userId],
        { enabled: !!userId }
    );
};

/**
 * Hook لجلب مزودي الخدمة المرتبطين
 */
export const useProviderLinkedFeatures = () => {
    return useApi(
        () => API.providers.getLinkedFeatures(),
        []
    );
};

/**
 * Hook لجلب إحصائيات المنصة
 * @param {Boolean} forceRefresh - إجبار التحديث
 */
export const usePlatformStats = (forceRefresh = false) => {
    return useApi(
        () => API.stats.getPlatformStats(),
        [forceRefresh]
    );
};

/**
 * Hook للبحث عن معالم
 * @param {Object} params - معاملات البحث
 * @param {Boolean} enabled - تفعيل البحث
 */
export const useSearch = (params, enabled = false) => {
    return useApi(
        () => API.search.searchFeatures(params),
        [JSON.stringify(params)],
        { enabled }
    );
};

export default {
    useApi,
    useRatings,
    usePendingComments,
    useProviderLinkedFeatures,
    usePlatformStats,
    useSearch
};
