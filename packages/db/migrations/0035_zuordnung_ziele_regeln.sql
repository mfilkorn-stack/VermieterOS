-- Zuordnung einer Mail zu Objekt oder Handwerker statt nur zu einem Mietverhältnis (UX-3),
-- dazu „erledigt“ ohne Ziel. Höchstens ein Ziel je Eintrag, nur innerhalb des Mandanten.

ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_objekt_fk
  FOREIGN KEY (objekt_id) REFERENCES objekte(id);
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_handwerker_fk
  FOREIGN KEY (handwerker_id) REFERENCES handwerker(id);
--> statement-breakpoint
CREATE TRIGGER nachricht_zuordnungen_bezug_objekt BEFORE INSERT ON nachricht_zuordnungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER nachricht_zuordnungen_bezug_handwerker BEFORE INSERT ON nachricht_zuordnungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('handwerker_id', 'handwerker');
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen DROP CONSTRAINT nachricht_zuordnungen_art_chk;
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_ziel_chk CHECK (
  (mietverhaeltnis_id IS NOT NULL)::int + (objekt_id IS NOT NULL)::int + (handwerker_id IS NOT NULL)::int <= 1
);
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_art_chk CHECK (
  CASE WHEN art IN ('aufgehoben', 'erledigt')
       THEN coalesce(mietverhaeltnis_id, objekt_id, handwerker_id) IS NULL
       ELSE coalesce(mietverhaeltnis_id, objekt_id, handwerker_id) IS NOT NULL END
);
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen DROP CONSTRAINT nachricht_zuordnungen_manuell_chk;
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_manuell_chk CHECK (
  art NOT IN ('manuell', 'aufgehoben', 'erledigt') OR akteur_art = 'nutzer'
);
--> statement-breakpoint
-- Automatik ordnet nur Mietverhältnissen zu; Objekt und Handwerker setzt ein Mensch.
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_ziel_nutzer_chk CHECK (
  (objekt_id IS NULL AND handwerker_id IS NULL) OR art = 'manuell'
);
--> statement-breakpoint
DROP VIEW nachrichten_zuordnung_aktuell;
--> statement-breakpoint
CREATE VIEW nachrichten_zuordnung_aktuell WITH (security_invoker = true) AS
SELECT DISTINCT ON (z.nachricht_id)
  z.nachricht_id, z.mandant_id, z.mietverhaeltnis_id, z.objekt_id, z.handwerker_id, z.art,
  z.begruendung, z.akteur_art, z.akteur_id, z.erfasst_am
FROM nachricht_zuordnungen z
ORDER BY z.nachricht_id, z.erfasst_am DESC, z.id DESC;
--> statement-breakpoint
GRANT SELECT ON nachrichten_zuordnung_aktuell TO vermieteros_app, vermieteros_worker;
