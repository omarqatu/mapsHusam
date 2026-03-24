DO $$ 
DECLARE 
    tbl TEXT;
    all_tables TEXT[] := ARRAY['ApartRent', 'ApartSale', 'LandSale', 'electrician', 'ac_technician', 'plumber', 'general_maintenance', 'painter', 'carpenter', 'blacksmith', 'builder', 'house_cleaner', 'aluminum_tech', 'car_mechanic', 'car_electrician', 'tire_tech', 'car_wash', 'motorcycle_repair', 'taxi_driver', 'delivery_services', 'tow_truck', 'cctv_installer', 'party_planner', 'zaffa_bands', 'music_bands', 'photographer', 'party_rental', 'home_nurse', 'masseur', 'cupping_specialist', 'nutritionist', 'truck_driver', 'security_firms', 'furniture_buyer', 'gardener', 'pet_care', 'clown_entertainer'];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE 'UPDATE "' || tbl || '" SET auto_status = auto_status'; -- هذا السطر يفعّل التريجر فقط
    END LOOP;
END $$;