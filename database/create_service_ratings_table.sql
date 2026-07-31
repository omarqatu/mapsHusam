-- إنشاء جدول التقييمات والتعليقات لمزودي الخدمات
-- يتم إنشاؤه في قاعدة بيانات services_db

CREATE TABLE IF NOT EXISTS public.service_ratings (
    id SERIAL PRIMARY KEY,
    request_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    provider_user_id INTEGER NOT NULL,
    service_layer VARCHAR(100) NOT NULL,
    feature_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- قيود فريدة لمنع التقييم المتكرر لنفس الطلب
    CONSTRAINT unique_rating_per_request UNIQUE (request_id, user_id),
    
    -- قيود خارجية للربط مع جداول الطلبات والمستخدمين
    CONSTRAINT fk_request FOREIGN KEY (request_id) 
        REFERENCES public.service_requests(id) ON DELETE CASCADE,
    CONSTRAINT fk_user FOREIGN KEY (user_id) 
        REFERENCES public.users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_provider FOREIGN KEY (provider_user_id) 
        REFERENCES public.users(user_id) ON DELETE CASCADE
);

-- إنشاء فهرس لتحسين أداء البحث عن تقييمات مزود معين
CREATE INDEX IF NOT EXISTS idx_service_ratings_provider 
    ON public.service_ratings(service_layer, feature_id);

-- إنشاء فهرس لتحسين أداء البحث عن تقييمات طلب معين
CREATE INDEX IF NOT EXISTS idx_service_ratings_request 
    ON public.service_ratings(request_id);

-- إنشاء فهرس لتحسين أداء البحث عن تقييمات مستخدم معين
CREATE INDEX IF NOT EXISTS idx_service_ratings_user 
    ON public.service_ratings(user_id);

-- تعليق على الجدول
COMMENT ON TABLE public.service_ratings IS 'جدول تخزين تقييمات وتعليقات المستخدمين على مزودي الخدمات بعد اكتمال الاتفاق';
COMMENT ON COLUMN public.service_ratings.rating IS 'التقييم من 1 إلى 5 نجوم';
COMMENT ON COLUMN public.service_ratings.comment IS 'التعليق النصي الاختياري على الخدمة';
