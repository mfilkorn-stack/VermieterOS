-- Papierkorb des Posteingangs: Mandantentrennung, append-only, nur Menschen löschen.

SELECT rls_einrichten('nachricht_loeschungen');
--> statement-breakpoint
SELECT append_only_einrichten('nachricht_loeschungen');
--> statement-breakpoint
CREATE TRIGGER nachricht_loeschungen_bezug BEFORE INSERT ON nachricht_loeschungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('nachricht_id', 'nachrichten');
--> statement-breakpoint
ALTER TABLE nachricht_loeschungen ADD CONSTRAINT nachricht_loeschungen_akteur_chk
  CHECK (akteur_art = 'nutzer');
--> statement-breakpoint
-- Nachrichten, deren jüngster Eintrag „gelöscht“ ist
CREATE VIEW nachrichten_im_papierkorb WITH (security_invoker = true) AS
SELECT l.nachricht_id, l.mandant_id, l.erfasst_am AS geloescht_am, l.akteur_id
FROM (
  SELECT DISTINCT ON (nachricht_id) *
  FROM nachricht_loeschungen
  ORDER BY nachricht_id, erfasst_am DESC, id DESC
) l
WHERE l.geloescht;
--> statement-breakpoint
GRANT SELECT, INSERT ON nachricht_loeschungen TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT ON nachricht_loeschungen TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT ON nachrichten_im_papierkorb TO vermieteros_app, vermieteros_worker;
