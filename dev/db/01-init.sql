-- Runs once, on first start of the dev Postgres container (see dev/dev.sh).
-- Schema + data come from `dev/dev.sh restore` (production dumps without personal data).
CREATE DATABASE services_db;
CREATE DATABASE realestate;
\connect services_db
CREATE EXTENSION IF NOT EXISTS postgis;
\connect realestate
CREATE EXTENSION IF NOT EXISTS postgis;
