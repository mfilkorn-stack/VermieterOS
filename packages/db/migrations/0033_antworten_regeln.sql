-- Antworten aus der App auf eingegangene Mails: Mandantentrennung, append-only, nur Nutzer.

SELECT rls_einrichten('antworten');
--> statement-breakpoint
SELECT append_only_einrichten('antworten');
--> statement-breakpoint
ALTER TABLE antworten ADD CONSTRAINT antworten_mv_fk
  FOREIGN KEY (mietverhaeltnis_id) REFERENCES mietverhaeltnisse(id);
--> statement-breakpoint
CREATE TRIGGER antworten_bezug_nachricht BEFORE INSERT ON antworten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('nachricht_id', 'nachrichten');
--> statement-breakpoint
CREATE TRIGGER antworten_bezug_mv BEFORE INSERT ON antworten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
ALTER TABLE antworten ADD CONSTRAINT antworten_text_chk
  CHECK (cardinality(an) > 0 AND length(btrim(betreff)) > 0 AND length(btrim(text)) > 0);
--> statement-breakpoint
-- Antworten schreibt ein Mensch, kein Automat.
ALTER TABLE antworten ADD CONSTRAINT antworten_akteur_chk CHECK (akteur_art = 'nutzer');
--> statement-breakpoint
GRANT SELECT, INSERT ON antworten TO vermieteros_app;
