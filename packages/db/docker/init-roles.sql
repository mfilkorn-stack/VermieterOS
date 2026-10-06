-- Läuft einmalig beim ersten Start des Postgres-Containers (docker-compose).
-- Produktion: dieselben Rollen von Hand anlegen, Passwörter aus dem Secret-Store.
CREATE ROLE vermieteros_owner LOGIN PASSWORD 'owner' NOBYPASSRLS;
CREATE ROLE vermieteros_app LOGIN PASSWORD 'app' NOBYPASSRLS;
CREATE ROLE vermieteros_worker LOGIN PASSWORD 'worker' NOBYPASSRLS;
ALTER DATABASE vermieteros OWNER TO vermieteros_owner;
\connect vermieteros
ALTER SCHEMA public OWNER TO vermieteros_owner;
GRANT USAGE ON SCHEMA public TO vermieteros_app;
