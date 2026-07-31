-- ============================================
-- سكربت إضافة طبقة خدمة جديدة
-- استبدل 'layer_name' بالاسم الفعلي (مثال: glass_tech)
-- ============================================

-- المتغيرات - استبدلها بالقيم الفعلية
-- DO $$
-- DECLARE
--     layer_name TEXT := 'glass_tech';          -- اسم الجدول بالإنجليزي
--     arabic_name TEXT := 'فني زجاج وسكريت';  -- الاسم العربي
--     icon_emoji TEXT := '🪟';                 -- الأيقونة
-- BEGIN
--     -- الكود سيتم تنفيذه هنا
-- END $$;

-- 1. إنشاء الجدول
CREATE TABLE IF NOT EXISTS public.layer_name (
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
CREATE INDEX IF NOT EXISTS layer_name_geom_idx ON public.layer_name USING GIST (geom);

-- 3. إنشاء دالة التريجر
CREATE OR REPLACE FUNCTION fn_process_layer_name()
RETURNS TRIGGER AS $$
DECLARE
    loc_record RECORD;
BEGIN
    SELECT location, gov_a, village_a 
    INTO loc_record
    FROM location_layer
    WHERE ST_Intersects(location_layer.geom, NEW.geom)
    LIMIT 1;

    NEW.location_name := loc_record.location;
    NEW.gov_a := loc_record.gov_a;
    NEW.village_a := loc_record.village_a;
    NEW.x_global := ST_X(NEW.geom);
    NEW.y_global := ST_Y(NEW.geom);
    NEW.x_coord := ST_X(ST_Transform(NEW.geom, 28191));
    NEW.y_coord := ST_Y(ST_Transform(NEW.geom, 28191));

    IF (NEW.status <> 0 OR (NEW.end_date IS NOT NULL AND NEW.end_date < CURRENT_DATE)) THEN
        NEW.auto_status := 1;
    ELSE
        NEW.auto_status := 0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. تفعيل التريجر
DROP TRIGGER IF EXISTS trg_layer_name_auto ON public.layer_name;
CREATE TRIGGER trg_layer_name_auto
BEFORE INSERT OR UPDATE ON layer_name
FOR EACH ROW
EXECUTE FUNCTION fn_process_layer_name();

-- ============================================
-- بعد التنفيذ:
-- 1. استبدل layer_name بـ 4 أماكن في هذا الملف
-- 2. نفذ السكربت على قاعدة services_db
-- 3. انشر الطبقة في GeoServer
-- 4. استخدم أداة add-layer.js لتعديل ملفات JavaScript
-- ============================================
