@echo off

REM ===== PostgreSQL 15 bin path =====
set PGBIN="C:\Program Files\PostgreSQL\15\bin"

REM ===== PostgreSQL connection settings =====
set PGUSER=Husam
set PGPASSWORD=1234
set PGHOST=localhost
set PGPORT=5432

REM ===== Backup folder = same folder as this bat file =====
set BACKUP_DIR=%~dp0

echo Starting backup...

REM ===== Backup realestate (overwrite each time) =====
%PGBIN%\pg_dump.exe -U %PGUSER% -h %PGHOST% -p %PGPORT% -F c -b -v -f "%BACKUP_DIR%realestate.backup" realestate

REM ===== Backup services_db (overwrite each time) =====
%PGBIN%\pg_dump.exe -U %PGUSER% -h %PGHOST% -p %PGPORT% -F c -b -v -f "%BACKUP_DIR%services_db.backup" services_db

echo Backup Finished

REM ================================
REM Backup GeoServer Data Directory
REM ================================

REM ===== Source and Destination =====
set SOURCE=C:\ProgramData\GeoServer
set DEST=C:\xampp\htdocs\realestate-map\WEB\PSM\GeoServerData

REM ===== Create destination folder if not exists =====
if not exist "%DEST%" mkdir "%DEST%"

echo Starting GeoServer Data backup...

REM ===== Copy all files and folders, overwrite existing =====
xcopy "%SOURCE%\*" "%DEST%\" /E /H /C /I /Y

echo Backup finished!
pause