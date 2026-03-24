@echo off
set PGPASSWORD=كلمة_سر_القاعدة
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d services_db -f "C:\path\to\update_status.sql"
"C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d realestate -f "C:\path\to\update_status.sql"