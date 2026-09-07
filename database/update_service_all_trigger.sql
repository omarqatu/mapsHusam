-- ============================================
-- تحديث trigger auto_status لجدول service_all الموحد
-- ليشمل التحقق من ساعات العمل
-- ============================================

-- دالة مساعدة للتحقق من الوقت الحالي ضمن ساعات العمل
CREATE OR REPLACE FUNCTION fn_check_work_hours(work_hours varchar)
RETURNS boolean AS $$
DECLARE
    is_24h boolean := false;
    start_time time;
    end_time time;
    now_time time;
    parts text[];
BEGIN
    -- إذا لم توجد ساعات عمل، نعتبرها متاحة 24 ساعة
    IF work_hours IS NULL OR work_hours = '' THEN
        RETURN true;
    END IF;

    -- التحقق من "متوفر 24 ساعة"
    IF work_hours ILIKE '%24 ساعة%' OR work_hours ILIKE '%24hour%' OR work_hours ILIKE '%24h%' OR work_hours ILIKE '%متوفر 24 ساعة%' THEN
        RETURN true;
    END IF;

    -- محاولة استخراج وقت البداية والنهاية من الصيغة "HH:MM-HH:MM"
    parts := regexp_matches(work_hours, '(\d{1,2}:\d{2})-(\d{1,2}:\d{2})');
    
    IF parts IS NULL OR array_length(parts, 1) < 2 THEN
        -- إذا لم نتمكن من تحليل الصيغة، نعتبرها متاحة
        RETURN true;
    END IF;

    -- تحويل النصوص إلى time
    BEGIN
        start_time := to_timestamp(parts[1], 'HH24:MI')::time;
        end_time := to_timestamp(parts[2], 'HH24:MI')::time;
    EXCEPTION WHEN OTHERS THEN
        -- في حالة خطأ في التحليل، نعتبرها متاحة
        RETURN true;
    END;

    -- الحصول على الوقت الحالي
    now_time := CURRENT_TIME;

    -- التحقق من أن الوقت الحالي ضمن النطاق
    IF start_time <= end_time THEN
        -- حالة عادية (مثال: 08:00-16:00)
        RETURN now_time >= start_time AND now_time <= end_time;
    ELSE
        -- حالة عبر منتصف الليل (مثال: 22:00-06:00)
        RETURN now_time >= start_time OR now_time <= end_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- تحديث الدالة الموحدة fn_geo_auto_fields ليشمل التحقق من ساعات العمل
CREATE OR REPLACE FUNCTION public.fn_geo_auto_fields()
RETURNS TRIGGER AS $$
DECLARE
    loc_name    TEXT;
    loc_gov     TEXT;
    loc_village TEXT;
    global_point geometry;
    is_within_hours boolean;
BEGIN
    -- 1) التقاطع المكاني مع طبقة المناطق لجلب location / gov_a / village_a
    IF NEW.geom IS NOT NULL THEN
        SELECT l.location, l.gov_a, l.village_a
        INTO loc_name, loc_gov, loc_village
        FROM public.location_layer l
        WHERE ST_Intersects(l.geom, NEW.geom)
        LIMIT 1;

        NEW.location_name := COALESCE(loc_name, 'غير محدد');
        NEW.gov_a          := COALESCE(loc_gov, 'غير محدد');
        NEW.village_a       := COALESCE(loc_village, 'غير محدد');

        -- 2) الإحداثيات الفلسطينية (نفس نظام إحداثيات geom، أي EPSG:28191)
        NEW.x_coord := ST_X(NEW.geom);
        NEW.y_coord := ST_Y(NEW.geom);

        -- 3) الإحداثيات العالمية (تحويل إلى WGS84)
        global_point := ST_Transform(NEW.geom, 4326);
        NEW.x_global := ST_X(global_point);
        NEW.y_global := ST_Y(global_point);
    END IF;

    -- 4) التحقق من ساعات العمل
    is_within_hours := fn_check_work_hours(NEW.work_hours);

    -- 5) حساب auto_status: 1 = مخفي عن الخريطة، 0 = ظاهر
    IF NEW.status IS DISTINCT FROM 0 THEN
        NEW.auto_status := 1;
    ELSIF NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE THEN
        NEW.auto_status := 1;
    ELSIF NOT is_within_hours THEN
        -- 🆕 إضافة شرط ساعات العمل: إذا كان الوقت الحالي خارج ساعات العمل
        NEW.auto_status := 1;
    ELSE
        NEW.auto_status := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة تفعيل التريجر على service_all
DROP TRIGGER IF EXISTS trg_service_all_auto ON public.service_all;
CREATE TRIGGER trg_service_all_auto
BEFORE INSERT OR UPDATE ON service_all
FOR EACH ROW
EXECUTE FUNCTION public.fn_geo_auto_fields();

-- ============================================
-- ملاحظات هامة:
-- 1. هذا السكربت يقوم بتحديث trigger لجدول service_all الموحد
-- 2. بعد التنفيذ، سيتم حساب auto_status بناءً على:
--    - status (0 = متوفر يدوياً)
--    - end_date (لم ينتهِ بعد)
--    - work_hours (ضمن الوقت الحالي)
-- 3. يجب تنفيذ هذا السكربت على قاعدة البيانات
-- ============================================
