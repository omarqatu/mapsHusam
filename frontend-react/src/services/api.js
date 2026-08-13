/**
 * API Service Layer - طبقة مركزية للاتصال بالسيرفر
 * تخدم نسخة Desktop و Mobile معاً
 * أي تعديل هنا ينعكس على المنصتين تلقائياً
 */

// إعدادات الأساسية
const API_BASE_URL = window.location.origin;

// Retry mechanism للطلبات الفاشلة
const fetchWithRetry = async (url, options = {}, maxRetries = 3) => {
    let retryCount = 0;
    
    while (retryCount < maxRetries) {
        try {
            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            retryCount++;
            if (retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            } else {
                throw error;
            }
        }
    }
};

// API Endpoints
export const API = {
    // التقييمات
    ratings: {
        getFeatureRatings: async (serviceLayer, featureId) => {
            return fetchWithRetry(
                `${API_BASE_URL}/api/service-ratings?service_layer=${serviceLayer}&feature_id=${featureId}`
            );
        },
        getPendingComments: async (userId) => {
            return fetchWithRetry(
                `${API_BASE_URL}/api/service-ratings/pending-comments?user_id=${userId}`
            );
        }
    },
    
    // مزودي الخدمة المرتبطين
    providers: {
        getLinkedFeatures: async () => {
            return fetchWithRetry(`${API_BASE_URL}/api/provider-linked-features`);
        }
    },
    
    // إحصائيات المنصة
    stats: {
        getPlatformStats: async () => {
            return fetchWithRetry(`${API_BASE_URL}/api/platform-stats`);
        }
    },
    
    // التحقق من الجلسة
    auth: {
        verifySession: async () => {
            return fetchWithRetry(`${API_BASE_URL}/api/auth/verify-session`);
        }
    },
    
    // طلبات الخدمة
    serviceRequests: {
        getPending: async (providerUserId) => {
            return fetchWithRetry(
                `${API_BASE_URL}/api/service-requests?provider_user_id=${providerUserId}&status=pending`
            );
        }
    },
    
    // البحث
    search: {
        searchFeatures: async (params) => {
            const queryString = new URLSearchParams(params).toString();
            return fetchWithRetry(`${API_BASE_URL}/api/search-features?${queryString}`);
        }
    }
};

export default API;
