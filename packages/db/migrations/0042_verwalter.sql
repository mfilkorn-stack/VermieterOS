ALTER TABLE "objekt_versionen" ADD COLUMN "verwalter" jsonb;
--> statement-breakpoint
-- Sicht neu, damit sie die neue Spalte trägt; der Neuaufbau vergibt nur das Recht der App,
-- der Worker braucht seins wieder (Zuordnung, KI-Kontext; Migration 0014).
SELECT aktuell_sicht_neu('objekte', 'objekt_versionen', 'objekt_id');
--> statement-breakpoint
GRANT SELECT ON objekte_aktuell TO vermieteros_worker;
