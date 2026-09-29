-- Runs once, on first start of the dev Postgres container (see dev/dev.sh).
CREATE DATABASE services_db;
CREATE DATABASE realestate;

\connect services_db

-- Columns read/written by server.js (auth, /api/admin/users, register). Extra columns the server
-- adds itself (force_logout_flag, token_version, whatsapp_number, …) are created at its startup.
CREATE TABLE IF NOT EXISTS public.users (
    user_id              SERIAL PRIMARY KEY,
    full_name            TEXT,
    email                TEXT,
    phone                TEXT NOT NULL UNIQUE,
    password_hash        TEXT NOT NULL,
    role                 TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'provider', 'user')),
    status               INTEGER NOT NULL DEFAULT 0,
    is_active            BOOLEAN NOT NULL DEFAULT false,
    service_layer        TEXT,
    feature_id           INTEGER,
    x_coord              DOUBLE PRECISION,
    y_coord              DOUBLE PRECISION,
    request_limit        INTEGER,
    request_limit_period TEXT,
    created_at           TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.map_service_stats (
    id         SERIAL PRIMARY KEY,
    layer_name TEXT,
    event_type TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
