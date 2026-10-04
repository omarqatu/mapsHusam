-- ============================================================================
-- local_test_seed.sql
-- قاعدة بيانات اختبار محلية مصغّرة تحاكي بنية الإنتاج (services_db + realestate)
-- تُستخدم لتشغيل السيرفر واختبار السيناريوهات الموثقة في docs/OPERATIONS_AND_TEST_GUIDE.md
-- بدون لمس قاعدة الإنتاج.
--
-- الاستخدام (PostgreSQL 16 + PostGIS 3):
--   createdb services_db && createdb realestate
--   psql -d services_db -v db=services  -f database/local_test_seed.sql
--   psql -d realestate  -v db=realestate -f database/local_test_seed.sql
-- (الملف يتحقق من اسم القاعدة الحالية ويُنشئ الجداول المناسبة لها)
-- كلمة مرور كل الحسابات التجريبية: Test1234
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS postgis;

DO $seed$
BEGIN
IF current_database() = 'services_db' THEN
    -- ---------------------------------------------------------------- users
    CREATE TABLE IF NOT EXISTS public.users (
        user_id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT UNIQUE,
        phone TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        status INTEGER DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        service_layer TEXT,
        feature_id INTEGER,
        x_coord NUMERIC,
        y_coord NUMERIC,
        request_limit INTEGER,
        request_limit_period TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.location_layer (
        id SERIAL PRIMARY KEY,
        location TEXT, gov_a TEXT, village_a TEXT,
        geom geometry(MultiPolygon, 28191)
    );

    -- ---------------------------------------------------------- service_all
    CREATE TABLE IF NOT EXISTS public.service_all (
        id SERIAL PRIMARY KEY,
        discriminator TEXT NOT NULL,
        geom geometry(Point, 28191),
        name VARCHAR(255), whatsapp VARCHAR(50), phone VARCHAR(50),
        des TEXT, pic TEXT, video TEXT,
        rating NUMERIC(3,1) DEFAULT 5,
        details_link_1 TEXT, details_link_2 TEXT,
        end_date DATE, work_hours VARCHAR(100),
        location_name VARCHAR(255),
        x_coord NUMERIC, y_coord NUMERIC, x_global NUMERIC, y_global NUMERIC,
        status INTEGER DEFAULT 0,
        gov_a VARCHAR(255), village_a VARCHAR(255),
        start_date DATE, auto_status INTEGER DEFAULT 0,
        search_tags TEXT, price NUMERIC, area NUMERIC, currency TEXT,
        stop TEXT, stop2 TEXT, display_order INTEGER, updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS public.road_barriers (id SERIAL PRIMARY KEY);
    CREATE TABLE IF NOT EXISTS public.fuel_stations (id SERIAL PRIMARY KEY);

    CREATE TABLE IF NOT EXISTS public.map_service_stats (
        id SERIAL PRIMARY KEY, user_identifier TEXT, provider_name TEXT,
        service_type TEXT, request_date TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.notifications (
        id SERIAL PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT, message TEXT,
        type TEXT, is_read BOOLEAN DEFAULT false, created_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS public.service_ratings (
        id SERIAL PRIMARY KEY, request_id INTEGER, user_id INTEGER, provider_user_id INTEGER,
        service_layer TEXT, feature_id INTEGER, rating INTEGER CHECK (rating BETWEEN 1 AND 5),
        comment TEXT, created_at TIMESTAMP DEFAULT NOW()
    );

    -- حسابات تجريبية (كلمة المرور النصية تُشفَّر تلقائياً بأول دخول - ترحيل السيرفر)
    INSERT INTO public.users (full_name, phone, email, password_hash, role, is_active)
    VALUES ('مشرف تجريبي', '0590000001', 'admin@test.local', 'Test1234', 'admin', true),
           ('مزود تجريبي', '0590000002', 'provider@test.local', 'Test1234', 'provider', true),
           ('مستخدم تجريبي', '0590000003', 'user@test.local', 'Test1234', 'user', true),
           ('مستخدم ثاني', '0590000004', 'user2@test.local', 'Test1234', 'user', true)
    ON CONFLICT DO NOTHING;

    -- خدمات تجريبية: متاحة / غير متاحة (status=1) / خارج الدوام / ملغاة (2) / منتهية / مخفية
    INSERT INTO public.service_all (discriminator, name, whatsapp, phone, status, work_hours, end_date, geom, x_coord, y_coord, rating)
    VALUES
      ('villas_rent', 'فيلا متاحة', '970590000010', '0590000010', 0, NULL, NULL, ST_SetSRID(ST_MakePoint(170000, 145000), 28191), 170000, 145000, 5),
      ('villas_rent', 'فيلا غير متاحة', '970590000011', '0590000011', 1, NULL, NULL, ST_SetSRID(ST_MakePoint(170050, 145050), 28191), 170050, 145050, 4),
      ('villas_rent', 'فيلا خارج الدوام', '970590000012', NULL, 0, '00:00-00:01', NULL, ST_SetSRID(ST_MakePoint(170100, 145100), 28191), 170100, 145100, 3),
      ('villas_rent', 'فيلا ملغاة', '970590000013', NULL, 2, NULL, NULL, ST_SetSRID(ST_MakePoint(170150, 145150), 28191), 170150, 145150, 3),
      ('villas_rent', 'فيلا منتهية الاشتراك', '970590000014', NULL, 0, NULL, DATE '2020-01-01', ST_SetSRID(ST_MakePoint(170200, 145200), 28191), 170200, 145200, 3),
      ('electrician', 'كهربائي (طبقة مخفية)', '970590000015', NULL, 0, NULL, NULL, ST_SetSRID(ST_MakePoint(170250, 145250), 28191), 170250, 145250, 5);

    -- ربط المزود التجريبي بالخدمة الأولى (الربط القديم بخانة واحدة)
    UPDATE public.users SET service_layer = 'villas_rent', feature_id = (SELECT MIN(id) FROM public.service_all)
    WHERE phone = '0590000002';

ELSIF current_database() = 'realestate' THEN
    CREATE TABLE IF NOT EXISTS public."ApartRent" (
        fid SERIAL PRIMARY KEY, geom geometry(Point, 28191),
        name TEXT, price NUMERIC, area NUMERIC, des TEXT, whatsapp TEXT, phone TEXT, pic TEXT, video TEXT,
        status INTEGER DEFAULT 0, auto_status INTEGER DEFAULT 0, end_date DATE, work_hours TEXT,
        x_coord NUMERIC, y_coord NUMERIC, location TEXT, gov_a TEXT, village_a TEXT,
        rating NUMERIC DEFAULT 5, search_tags TEXT, currency TEXT, start_date DATE
    );
    CREATE TABLE IF NOT EXISTS public."ApartSale" (LIKE public."ApartRent" INCLUDING ALL);
    CREATE TABLE IF NOT EXISTS public."LandSale" (
        fid SERIAL PRIMARY KEY, geom geometry(MultiPolygon, 28191),
        name TEXT, price NUMERIC, area NUMERIC, des TEXT, whatsapp TEXT, phone TEXT, pic TEXT, video TEXT,
        status INTEGER DEFAULT 0, auto_status INTEGER DEFAULT 0, end_date DATE,
        location TEXT, gov_a TEXT, village_a TEXT, rating NUMERIC DEFAULT 5, search_tags TEXT, currency TEXT, start_date DATE
    );
    CREATE TABLE IF NOT EXISTS public."Location" (fid SERIAL PRIMARY KEY, geom geometry(MultiPolygon, 28191), location TEXT, gov_a TEXT, village_a TEXT, status INTEGER DEFAULT 0, auto_status INTEGER DEFAULT 0, rating NUMERIC);

    INSERT INTO public."ApartRent" (name, price, area, whatsapp, phone, status, auto_status, geom, x_coord, y_coord)
    VALUES ('شقة متوفرة', 400, 120, '970590000020', '0590000020', 0, 0, ST_SetSRID(ST_MakePoint(171000, 146000), 28191), 171000, 146000),
           ('شقة مؤجرة (غير متوفرة)', 500, 140, '970590000021', NULL, 1, 1, ST_SetSRID(ST_MakePoint(171050, 146050), 28191), 171050, 146050);
END IF;
END
$seed$;
