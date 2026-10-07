-- Handwerker, Notfallkarte, Wissensbasis, Tickets (WP 1.6): Versionsmuster, RLS, Bezüge.
SELECT versionierung_einrichten('handwerker', 'handwerker', 'handwerker_versionen', 'handwerker_id');
--> statement-breakpoint
SELECT versionierung_einrichten('notfallkarte', 'notfallkarten', 'notfallkarte_versionen', 'notfallkarte_id');
--> statement-breakpoint
SELECT versionierung_einrichten('wissensartikel', 'wissensartikel', 'wissensartikel_versionen', 'wissensartikel_id');
--> statement-breakpoint
SELECT versionierung_einrichten('ticket', 'tickets', 'ticket_versionen', 'ticket_id');
--> statement-breakpoint

CREATE TRIGGER notfallkarten_bezug_objekt BEFORE INSERT ON notfallkarten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER wissensartikel_bezug_objekt BEFORE INSERT ON wissensartikel
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER tickets_bezug_objekt BEFORE INSERT ON tickets
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER tickets_bezug_einheit BEFORE INSERT ON tickets
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('einheit_id', 'einheiten');
--> statement-breakpoint
CREATE TRIGGER tickets_bezug_mv BEFORE INSERT ON tickets
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER tickets_bezug_nachricht BEFORE INSERT ON tickets
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('nachricht_id', 'nachrichten');
--> statement-breakpoint
CREATE TRIGGER ticket_versionen_bezug_handwerker BEFORE INSERT ON ticket_versionen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('auftragnehmer_id', 'handwerker');
--> statement-breakpoint

ALTER TABLE handwerker_versionen ADD CONSTRAINT handwerker_gewerke_chk CHECK (cardinality(gewerke) > 0);
--> statement-breakpoint
ALTER TABLE handwerker_versionen ADD CONSTRAINT handwerker_bewertung_chk CHECK (bewertung BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE wissensartikel_versionen ADD CONSTRAINT wissensartikel_kategorie_chk
  CHECK (kategorie IN ('hausordnung', 'anleitung', 'muell', 'faq', 'sonstiges'));
--> statement-breakpoint
ALTER TABLE ticket_versionen ADD CONSTRAINT ticket_status_chk
  CHECK (status IN ('gemeldet', 'beauftragt', 'termin', 'erledigt', 'abgeschlossen', 'verworfen'));
--> statement-breakpoint
ALTER TABLE ticket_versionen ADD CONSTRAINT ticket_prioritaet_chk
  CHECK (prioritaet IN ('notfall', 'hoch', 'normal', 'niedrig'));
--> statement-breakpoint
ALTER TABLE notfallkarte_versionen ADD CONSTRAINT notfallkarte_eintraege_chk
  CHECK (jsonb_typeof(eintraege) = 'array');
--> statement-breakpoint

-- Der Worker baut den KI-Kontext zu Mails (WP 1.5); dazu gehören Notfallkarte und Wissensbasis.
GRANT SELECT ON handwerker, handwerker_versionen, handwerker_aktuell,
  notfallkarten, notfallkarte_versionen, notfallkarten_aktuell,
  wissensartikel, wissensartikel_versionen, wissensartikel_aktuell, stornos
TO vermieteros_worker;
