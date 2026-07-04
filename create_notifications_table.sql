-- ============================================
-- كود PostgreSQL لإنشاء جدول الإشعارات
-- قاعدة البيانات: services_db
-- ============================================

-- 1. إنشاء جدول الإشعارات
CREATE TABLE IF NOT EXISTS "public"."notifications" (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'warning', 'success', 'error')),
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

-- 2. إنشاء فهارس للبحث السريع
-- فهرس للبحث حسب المستخدم وحالة القراءة
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON "public"."notifications" (user_id, is_read);

-- فهرس للبحث حسب تاريخ الإنترنت (للعرض الأحدث أولاً)
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON "public"."notifications" (created_at DESC);

-- فهرس للبحث حسب نوع الإشعار
CREATE INDEX IF NOT EXISTS idx_notifications_type ON "public"."notifications" (type);

-- 3. إضافة تعليقات على الجدول والأعمدة
COMMENT ON TABLE "public"."notifications" IS 'جدول تخزين الإشعارات للمستخدمين - نظام الإشعارات الهجين';

COMMENT ON COLUMN "public"."notifications".id IS 'معرف فريد للإشعار';
COMMENT ON COLUMN "public"."notifications".user_id IS 'معرف المستخدم المستلم للإشعار (يرتبط بجدول users)';
COMMENT ON COLUMN "public"."notifications".title IS 'عنوان الإشعار (أقصى 255 حرف)';
COMMENT ON COLUMN "public"."notifications".message IS 'نص الإشعار الكامل';
COMMENT ON COLUMN "public"."notifications".type IS 'نوع الإشعار: info (معلومات), warning (تحذير), success (نجاح), error (خطأ)';
COMMENT ON COLUMN "public"."notifications".is_read IS 'هل تم قراءة الإشعار؟ (true = مقروء, false = غير مقروء)';
COMMENT ON COLUMN "public"."notifications".created_at IS 'تاريخ ووقت إنشاء الإشعار';
COMMENT ON COLUMN "public"."notifications".read_at IS 'تاريخ ووقت قراءة الإشعار (NULL إذا لم يُقرأ بعد)';

-- 4. إنشاء دالة لتحديث تاريخ القراءة تلقائياً
CREATE OR REPLACE FUNCTION update_read_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_read = true AND (OLD.is_read = false OR OLD.is_read IS NULL) THEN
        NEW.read_at = CURRENT_TIMESTAMP;
    ELSIF NEW.is_read = false THEN
        NEW.read_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. إنشاء Trigger لتشغيل الدالة تلقائياً
DROP TRIGGER IF EXISTS trigger_update_read_timestamp ON "public"."notifications";
CREATE TRIGGER trigger_update_read_timestamp
    BEFORE UPDATE ON "public"."notifications"
    FOR EACH ROW
    EXECUTE FUNCTION update_read_timestamp();

-- 6. إنشاء دالة لحذف الإشعارات القديمة (اختياري - للصيانة)
CREATE OR REPLACE FUNCTION cleanup_old_notifications(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM "public"."notifications"
    WHERE is_read = true
    AND created_at < CURRENT_TIMESTAMP - INTERVAL '1 day' * days_to_keep;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- كود للتحقق من إنشاء الجدول بنجاح
-- ============================================

-- عرض معلومات الجدول
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'notifications'
AND table_schema = 'public'
ORDER BY ordinal_position;

-- عرض الفهارس
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'notifications'
AND schemaname = 'public';

-- ============================================
-- كود لحذف الجدول (للاستخدام في التطوير فقط)
-- ============================================

-- DROP TABLE IF EXISTS "public"."notifications" CASCADE;
-- DROP FUNCTION IF EXISTS update_read_timestamp() CASCADE;
-- DROP FUNCTION IF EXISTS cleanup_old_notifications(INTEGER) CASCADE;

-- ============================================
-- كود لإدراج بيانات تجريبية (للاختبار)
-- ============================================

-- INSERT INTO "public"."notifications" (user_id, title, message, type, is_read)
-- VALUES 
--     (1, 'مرحباً بك', 'تم تفعيل حسابك بنجاح', 'success', false),
--     (1, 'تنبيه', 'انتهت صلاحية اشتراكك خلال 3 أيام', 'warning', false),
--     (2, 'رسالة جديدة', 'لديك رسالة جديدة من الإدارة', 'info', false);

-- ============================================
-- كود للاستعلام عن الإشعارات غير المقروءة
-- ============================================

-- SELECT * FROM "public"."notifications"
-- WHERE user_id = 1 AND is_read = false
-- ORDER BY created_at DESC;

-- ============================================
-- كود لتعليم إشعار كمقروء
-- ============================================

-- UPDATE "public"."notifications"
-- SET is_read = true
-- WHERE id = 1;

-- ============================================
-- كود لاستخدام دالة تنظيف الإشعارات القديمة
-- ============================================

-- SELECT cleanup_old_notifications(30); -- حذف الإشعارات المقروءة الأقدم من 30 يوماً

