-- ============================================
-- سكربت إضافة طبقة عقارات جديدة
-- استبدل 'layer_name' بالاسم الفعلي (مثال: Buildings)
-- ============================================

-- 1. إنشاء الجدول
CREATE TABLE IF NOT EXISTS public."layer_name" (
    fid           SERIAL PRIMARY KEY,
    geom          geometry(Polygon, 28191),
    building_type varchar(100),
    floors        integer,
    gov_a         varchar(255),
    village_a     varchar(255),
    location      varchar(255),
    status        integer DEFAULT 0
);

-- 2. إنشاء الفهرس المكاني
CREATE INDEX IF NOT EXISTS layer_name_geom_idx ON public."layer_name" USING GIST (geom);

-- ============================================
-- بعد التنفيذ:
-- 1. استبدل layer_name بـ 3 أماكن في هذا الملف
-- 2. نفذ السكربت على قاعدة realestate
-- 3. انشر الطبقة في GeoServer
-- 4. استخدم أداة add-layer.js لتعديل ملفات JavaScript
-- ============================================
