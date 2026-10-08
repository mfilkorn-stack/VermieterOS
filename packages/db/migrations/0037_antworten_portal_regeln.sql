-- Antworten auch auf Nachrichten aus dem Mieterportal (UX-4): genau ein Bezug je Antwort.

CREATE TRIGGER antworten_bezug_portal BEFORE INSERT ON antworten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('portal_nachricht_id', 'portal_nachrichten');
--> statement-breakpoint
ALTER TABLE antworten ADD CONSTRAINT antworten_bezug_chk CHECK (
  (nachricht_id IS NOT NULL)::int + (portal_nachricht_id IS NOT NULL)::int = 1
);
