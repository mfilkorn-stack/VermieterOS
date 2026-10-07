-- Steuerpaket (WP 2.6): Versionsmuster, RLS, Bezüge, Sperre nach Festschreibung.
SELECT versionierung_einrichten('steuerpaket', 'steuerpakete', 'steuerpaket_versionen', 'steuerpaket_id');
--> statement-breakpoint
CREATE TRIGGER steuerpakete_bezug_objekt BEFORE INSERT ON steuerpakete
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER steuerpaket_versionen_bezug_dokument BEFORE INSERT ON steuerpaket_versionen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('paket_dokument_id', 'dokumente');
--> statement-breakpoint
ALTER TABLE steuerpakete ADD CONSTRAINT steuerpakete_jahr_chk CHECK (jahr BETWEEN 2000 AND 2100);
--> statement-breakpoint
ALTER TABLE steuerpaket_versionen ADD CONSTRAINT steuerpaket_status_chk
  CHECK (status IN ('entwurf', 'festgeschrieben'));
--> statement-breakpoint
ALTER TABLE steuerpaket_versionen ADD CONSTRAINT steuerpaket_fest_chk
  CHECK (status = 'entwurf' OR (paket_dokument_id IS NOT NULL AND ueberschuss_cent IS NOT NULL));
--> statement-breakpoint
CREATE FUNCTION steuerpaket_festgeschrieben_sperren() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM steuerpaket_versionen v
    WHERE v.steuerpaket_id = NEW.steuerpaket_id
      AND v.status = 'festgeschrieben'
      AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
  ) THEN
    RAISE EXCEPTION 'Steuerpaket ist festgeschrieben; für eine Korrektur zuerst die Festschreibung stornieren';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER steuerpaket_versionen_festgeschrieben BEFORE INSERT ON steuerpaket_versionen
FOR EACH ROW EXECUTE FUNCTION steuerpaket_festgeschrieben_sperren();
