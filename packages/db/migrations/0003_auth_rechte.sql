-- Better-Auth-Tabellen (Schema auth): kein RLS, volle CRUD-Rechte für die App-Rolle.
-- Mandantenzugehörigkeit wird über auth.member geprüft, Fachdaten bleiben hinter RLS.
GRANT USAGE ON SCHEMA auth TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO vermieteros_app;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO vermieteros_app;
