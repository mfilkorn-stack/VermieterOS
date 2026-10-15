-- Handwerkerauftrag aus einem Ticket (P8): gleicher Versandweg und dieselbe Tabelle wie
-- Antworten, Bezug ist das Ticket, Empfänger der beauftragte Handwerker.

ALTER TABLE antworten ADD CONSTRAINT antworten_ticket_fk
  FOREIGN KEY (ticket_id) REFERENCES tickets(id);
--> statement-breakpoint
ALTER TABLE antworten ADD CONSTRAINT antworten_handwerker_fk
  FOREIGN KEY (handwerker_id) REFERENCES handwerker(id);
--> statement-breakpoint
CREATE TRIGGER antworten_bezug_ticket BEFORE INSERT ON antworten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('ticket_id', 'tickets');
--> statement-breakpoint
CREATE TRIGGER antworten_bezug_handwerker BEFORE INSERT ON antworten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('handwerker_id', 'handwerker');
--> statement-breakpoint
ALTER TABLE antworten DROP CONSTRAINT antworten_bezug_chk;
--> statement-breakpoint
ALTER TABLE antworten ADD CONSTRAINT antworten_bezug_chk CHECK (
  (nachricht_id IS NOT NULL)::int + (portal_nachricht_id IS NOT NULL)::int
    + (ticket_id IS NOT NULL)::int = 1
);
--> statement-breakpoint
-- Handwerker nur beim Auftrag aus einem Ticket
ALTER TABLE antworten ADD CONSTRAINT antworten_handwerker_chk
  CHECK (handwerker_id IS NULL OR ticket_id IS NOT NULL);
