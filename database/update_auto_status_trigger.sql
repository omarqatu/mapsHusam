-- ============================================
-- تحديث trigger auto_status ليشمل التحقق من ساعات العمل
-- ============================================
-- هذا السكربت يقوم بتحديث trigger لجميع طبقات الخدمات
-- ليشمل التحقق من ساعات العمل بالإضافة إلى status و end_date
-- ============================================

-- دالة مساعدة للتحقق من الوقت الحالي ضمن ساعات العمل
CREATE OR REPLACE FUNCTION fn_check_work_hours(work_hours varchar)
RETURNS boolean AS $$
DECLARE
    is_24h boolean := false;
    start_time time;
    end_time time;
    current_time time;
    parts text[];
BEGIN
    -- إذا لم توجد ساعات عمل، نعتبرها متاحة 24 ساعة
    IF work_hours IS NULL OR work_hours = '' THEN
        RETURN true;
    END IF;

    -- التحقق من "متوفر 24 ساعة"
    IF work_hours ILIKE '%24 ساعة%' OR work_hours ILIKE '%24hour%' OR work_hours ILIKE '%24h%' THEN
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
    current_time := CURRENT_TIME;

    -- التحقق من أن الوقت الحالي ضمن النطاق
    IF start_time <= end_time THEN
        -- حالة عادية (مثال: 08:00-16:00)
        RETURN current_time >= start_time AND current_time <= end_time;
    ELSE
        -- حالة عبر منتصف الليل (مثال: 22:00-06:00)
        RETURN current_time >= start_time OR current_time <= end_time;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- تحديث trigger لكل طبقة خدمة
-- ملاحظة: يجب استبدال 'layer_name' بالاسم الفعلي لكل طبقة

-- مثال لطبقة glass_tech
CREATE OR REPLACE FUNCTION fn_process_glass_tech()
RETURNS TRIGGER AS $$
DECLARE
    loc_record RECORD;
    is_within_hours boolean;
BEGIN
    -- جلب البيانات المكانية والإدارية من location_layer
    SELECT location, gov_a, village_a 
    INTO loc_record
    FROM location_layer
    WHERE ST_Intersects(location_layer.geom, NEW.geom)
    LIMIT 1;

    -- تعبئة الحقول الإدارية
    NEW.location_name := loc_record.location;
    NEW.gov_a := loc_record.gov_a;
    NEW.village_a := loc_record.village_a;

    -- تعبئة الإحداثيات
    NEW.x_global := ST_X(NEW.geom);
    NEW.y_global := ST_Y(NEW.geom);
    
    -- تعبئة x_coord/y_coord الفلسطيني
    NEW.x_coord := ST_X(ST_Transform(NEW.geom, 28191));
    NEW.y_coord := ST_Y(ST_Transform(NEW.geom, 28191));

    -- التحقق من ساعات العمل
    is_within_hours := fn_check_work_hours(NEW.work_hours);

    -- تحديد auto_status
    IF (NEW.status <> 0 OR 
        (NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE) OR
        NOT is_within_hours) THEN
        NEW.auto_status := 1;
    ELSE
        NEW.auto_status := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- إعادة تفعيل التريجر
DROP TRIGGER IF EXISTS trg_glass_tech_auto ON public.glass_tech;
CREATE TRIGGER trg_glass_tech_auto
BEFORE INSERT OR UPDATE ON glass_tech
FOR EACH ROW
EXECUTE FUNCTION fn_process_glass_tech();

-- ============================================
-- ملاحظات هامة:
-- 1. يجب تكرار هذا التحديث لكل طبقة خدمة في النظام
-- 2. استبدل 'glass_tech' و 'fn_process_glass_tech' و 'trg_glass_tech_auto'
--    بالأسماء المناسبة لكل طبقة
-- 3. بعد التنفيذ، سيتم حساب auto_status بناءً على:
--    - status (0 = متوفر يدوياً)
--    - end_date (لم ينتهِ بعد)
--    - work_hours (ضمن الوقت الحالي)
-- ============================================
