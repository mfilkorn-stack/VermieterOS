-- Fremdschlüssel-Prüfungen laufen ohne RLS. Ohne diese Trigger könnte eine Identität
-- (z. B. eine Einheit) auf eine Identität eines anderen Mandanten verweisen.
CREATE FUNCTION bezug_mandant_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_fk      text := TG_ARGV[0];
  v_ziel    text := TG_ARGV[1];
  v_id      uuid;
  v_mandant uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', v_fk) INTO v_id USING NEW;
  IF v_id IS NULL THEN
    RETURN NEW;
  END IF;
  EXECUTE format('SELECT mandant_id FROM %I WHERE id = $1', v_ziel) INTO v_mandant USING v_id;
  IF v_mandant IS NULL OR v_mandant <> NEW.mandant_id THEN
    RAISE EXCEPTION 'Bezug %.% gehört nicht zum Mandanten', v_ziel, v_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER einheiten_bezug_objekt BEFORE INSERT ON einheiten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER mietverhaeltnisse_bezug_einheit BEFORE INSERT ON mietverhaeltnisse
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('einheit_id', 'einheiten');
--> statement-breakpoint
CREATE TRIGGER mietkonditionen_bezug_mv BEFORE INSERT ON mietkonditionen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER zaehler_bezug_objekt BEFORE INSERT ON zaehler
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER zaehler_bezug_einheit BEFORE INSERT ON zaehler
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('einheit_id', 'einheiten');
--> statement-breakpoint
CREATE TRIGGER darlehen_bezug_objekt BEFORE INSERT ON darlehen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER dokumente_bezug_objekt BEFORE INSERT ON dokumente
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER dokumente_bezug_mv BEFORE INSERT ON dokumente
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER eigentumsanteile_bezug_person BEFORE INSERT ON eigentumsanteile
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('person_id', 'personen');
--> statement-breakpoint

-- Mieter eines Mietverhältnisses stehen als Array in der Version; jede Person muss zum Mandanten gehören.
CREATE FUNCTION mieter_mandant_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_fremd int;
BEGIN
  SELECT count(*) INTO v_fremd
  FROM unnest(NEW.mieter_ids) AS m(id)
  LEFT JOIN personen p ON p.id = m.id AND p.mandant_id = NEW.mandant_id
  WHERE p.id IS NULL;
  IF v_fremd > 0 THEN
    RAISE EXCEPTION 'Mieter gehört nicht zum Mandanten' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER mietverhaeltnis_versionen_mieter BEFORE INSERT ON mietverhaeltnis_versionen
FOR EACH ROW EXECUTE FUNCTION mieter_mandant_pruefen();
