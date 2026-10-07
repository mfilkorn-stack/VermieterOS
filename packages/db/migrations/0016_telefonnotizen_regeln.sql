-- Telefonnotizen (WP 1.2): Mandantentrennung, append-only, Korrektur als neue Notiz.

SELECT rls_einrichten('telefonnotizen');
--> statement-breakpoint
SELECT append_only_einrichten('telefonnotizen');
--> statement-breakpoint
ALTER TABLE telefonnotizen ADD CONSTRAINT telefonnotizen_mv_fk
  FOREIGN KEY (mietverhaeltnis_id) REFERENCES mietverhaeltnisse(id);
--> statement-breakpoint
CREATE TRIGGER telefonnotizen_bezug_mv BEFORE INSERT ON telefonnotizen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER telefonnotizen_bezug_ersetzt BEFORE INSERT ON telefonnotizen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('ersetzt_id', 'telefonnotizen');
--> statement-breakpoint
ALTER TABLE telefonnotizen ADD CONSTRAINT telefonnotizen_richtung_chk
  CHECK (richtung IN ('eingehend', 'ausgehend'));
--> statement-breakpoint
ALTER TABLE telefonnotizen ADD CONSTRAINT telefonnotizen_text_chk
  CHECK (length(btrim(gespraechspartner)) > 0 AND length(btrim(betreff)) > 0 AND length(btrim(inhalt)) > 0);
--> statement-breakpoint
-- Notizen schreibt ein Mensch, kein Automat.
ALTER TABLE telefonnotizen ADD CONSTRAINT telefonnotizen_akteur_chk CHECK (akteur_art = 'nutzer');
--> statement-breakpoint

-- Aktuelle Notizen: ohne die durch eine Korrektur ersetzten.
CREATE VIEW telefonnotizen_aktuell WITH (security_invoker = true) AS
SELECT t.*
FROM telefonnotizen t
WHERE NOT EXISTS (SELECT 1 FROM telefonnotizen k WHERE k.ersetzt_id = t.id);
--> statement-breakpoint

GRANT SELECT, INSERT ON telefonnotizen TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT ON telefonnotizen_aktuell TO vermieteros_app;
