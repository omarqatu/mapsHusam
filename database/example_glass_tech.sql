-- ============================================
-- مثال عملي: إضافة طبقة فني زجاج وسكريت
-- ============================================

-- 1. إنشاء الجدول
CREATE TABLE IF NOT EXISTS public.glass_tech (
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
CREATE INDEX IF NOT EXISTS glass_tech_geom_idx ON public.glass_tech USING GIST (geom);

-- 3. إنشاء دالة التريجر
CREATE OR REPLACE FUNCTION fn_process_glass_tech()
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
DROP TRIGGER IF EXISTS trg_glass_tech_auto ON public.glass_tech;
CREATE TRIGGER trg_glass_tech_auto
BEFORE INSERT OR UPDATE ON glass_tech
FOR EACH ROW
EXECUTE FUNCTION fn_process_glass_tech();

-- ============================================
-- التعليمات:
-- 1. نفذ هذا السكربت على قاعدة services_db
-- 2. انشر الطبقة في GeoServer باسم glass_tech
-- 3. شغّل الأمر: node tools/add-layer.js --type service --name glass_tech --arabic "فني زجاج وسكريت" --icon "🪟"
-- 4. أعد تشغيل الخادم
-- ============================================
