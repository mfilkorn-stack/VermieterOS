-- Betriebskostenabrechnung (WP 2.4): Versionsmuster, RLS, Bezug, Sperre nach Festschreibung.
SELECT versionierung_einrichten('bk_abrechnung', 'bk_abrechnungen', 'bk_abrechnung_versionen', 'bk_abrechnung_id');
--> statement-breakpoint
CREATE TRIGGER bk_abrechnungen_bezug_einheit BEFORE INSERT ON bk_abrechnungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('einheit_id', 'einheiten');
--> statement-breakpoint
ALTER TABLE bk_abrechnungen ADD CONSTRAINT bk_abrechnungen_jahr_chk CHECK (jahr BETWEEN 2000 AND 2100);
--> statement-breakpoint
ALTER TABLE bk_abrechnung_versionen ADD CONSTRAINT bk_abrechnung_status_chk
  CHECK (status IN ('entwurf', 'festgeschrieben'));
--> statement-breakpoint
ALTER TABLE bk_abrechnung_versionen ADD CONSTRAINT bk_abrechnung_zeitraum_chk
  CHECK (zeitraum_bis >= zeitraum_von AND zeitraum_bis < zeitraum_von + interval '12 months');
--> statement-breakpoint
ALTER TABLE bk_abrechnung_versionen ADD CONSTRAINT bk_abrechnung_positionen_chk
  CHECK (jsonb_typeof(positionen) = 'array');
--> statement-breakpoint
/* Eine festgeschriebene Abrechnung ändert sich nicht mehr. Für eine Korrektur wird die
   festgeschriebene Version storniert (mit Begründung); danach gilt wieder der Entwurf. */
CREATE FUNCTION bk_abrechnung_festgeschrieben_sperren() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM bk_abrechnung_versionen v
    WHERE v.bk_abrechnung_id = NEW.bk_abrechnung_id
      AND v.status = 'festgeschrieben'
      AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
  ) THEN
    RAISE EXCEPTION 'Abrechnung ist festgeschrieben; für eine Korrektur zuerst die Festschreibung stornieren';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER bk_abrechnung_versionen_festgeschrieben BEFORE INSERT ON bk_abrechnung_versionen
FOR EACH ROW EXECUTE FUNCTION bk_abrechnung_festgeschrieben_sperren();
