-- ============================================
-- سكربت إنشاء طبقة خدمة جديدة
-- استبدل 'new_service' بالاسم الفعلي للخدمة
-- ============================================

-- 1. إنشاء الجدول بنفس بنية طبقات الخدمات الأخرى
CREATE TABLE IF NOT EXISTS public.new_service (
    id            SERIAL PRIMARY KEY,
    geom          geometry(Point, 28191),
    name          varchar(255),
    whatsapp      varchar(50),
    des           text,
    pic           text,
    rating        numeric(3,1) DEFAULT 5,
    details_link_1 text,
    details_link_2 text,
    end_date      date,
    work_hours    varchar(100),
    location_name varchar(255),
    x_coord       numeric,
    y_coord       numeric,
    x_global      numeric,
    y_global      numeric,
    status        integer DEFAULT 0,
    gov_a         varchar(255),
    village_a     varchar(255),
    start_date    date,
    auto_status   integer DEFAULT 0,
    search_tags   text
);

-- 2. إنشاء الفهرس المكاني
CREATE INDEX IF NOT EXISTS new_service_geom_idx ON public.new_service USING GIST (geom);

-- 3. إنشاء دالة التريجر (Trigger Function)
CREATE OR REPLACE FUNCTION fn_process_new_service()
RETURNS TRIGGER AS $$
DECLARE
    loc_record RECORD;
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

    -- تحديد auto_status
    IF (NEW.status <> 0 OR (NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE)) THEN
        NEW.auto_status := 1;
    ELSE
        NEW.auto_status := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. تفعيل التريجر
DROP TRIGGER IF EXISTS trg_new_service_auto ON public.new_service;
CREATE TRIGGER trg_new_service_auto
BEFORE INSERT OR UPDATE ON new_service
FOR EACH ROW
EXECUTE FUNCTION fn_process_new_service();

-- ============================================
-- ملاحظات هامة:
-- 1. استبدل 'new_service' بالاسم الفعلي للخدمة (مثال: 'glass_tech')
-- 2. استبدل 'fn_process_new_service' و 'trg_new_service_auto' بأسماء مناسبة
-- 3. بعد التنفيذ، تأكد من أن الجدول تم إنشاؤه بنجاح
-- ============================================
