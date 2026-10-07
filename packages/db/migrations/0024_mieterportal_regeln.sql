-- Mieterportal (WP 1.10, ADR 0010): eigene Identität mit Einmal-Links, getrennt von Better Auth.

-- Zugänge: der Vermieter sieht nur seine (RLS). Bewusst ohne FORCE: die Anmeldefunktionen
-- unten laufen als Eigentümer der Tabelle und müssen eine Adresse über alle Mandanten finden,
-- bevor ein Mandant feststeht. Die App-Rolle bleibt an die Policy gebunden.
ALTER TABLE portal_zugaenge ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY mandant_isolation ON portal_zugaenge
  USING (mandant_id = aktueller_mandant()) WITH CHECK (mandant_id = aktueller_mandant());
--> statement-breakpoint
CREATE TRIGGER portal_zugaenge_bezug_mv BEFORE INSERT ON portal_zugaenge
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER portal_zugaenge_bezug_person BEFORE INSERT ON portal_zugaenge
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('person_id', 'personen');
--> statement-breakpoint
ALTER TABLE portal_zugaenge ADD CONSTRAINT portal_zugaenge_email_chk
  CHECK (email = lower(btrim(email)) AND email LIKE '%_@_%');
--> statement-breakpoint
CREATE TRIGGER portal_zugaenge_kein_delete BEFORE DELETE ON portal_zugaenge
FOR EACH ROW EXECUTE FUNCTION verhindere_loeschen();
--> statement-breakpoint
-- Ändern lässt sich nur der Widerruf, und nur einmal.
CREATE FUNCTION portal_zugang_nur_widerruf() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.widerrufen_am IS NOT NULL
     OR (NEW.id, NEW.mandant_id, NEW.mietverhaeltnis_id, NEW.person_id, NEW.email, NEW.erstellt_am, NEW.erstellt_von)
        IS DISTINCT FROM
        (OLD.id, OLD.mandant_id, OLD.mietverhaeltnis_id, OLD.person_id, OLD.email, OLD.erstellt_am, OLD.erstellt_von)
  THEN
    RAISE EXCEPTION 'Portalzugang: nur ein einmaliger Widerruf ist erlaubt'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER portal_zugaenge_nur_widerruf BEFORE UPDATE ON portal_zugaenge
FOR EACH ROW EXECUTE FUNCTION portal_zugang_nur_widerruf();
--> statement-breakpoint
GRANT SELECT, INSERT ON portal_zugaenge TO vermieteros_app;
--> statement-breakpoint
GRANT UPDATE (widerrufen_am, widerrufen_von) ON portal_zugaenge TO vermieteros_app;
--> statement-breakpoint

-- Nachrichten aus dem Portal: append-only, mandantengetrennt.
SELECT rls_einrichten('portal_nachrichten');
--> statement-breakpoint
SELECT append_only_einrichten('portal_nachrichten');
--> statement-breakpoint
CREATE TRIGGER portal_nachrichten_bezug_mv BEFORE INSERT ON portal_nachrichten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
CREATE TRIGGER portal_nachrichten_bezug_zugang BEFORE INSERT ON portal_nachrichten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('zugang_id', 'portal_zugaenge');
--> statement-breakpoint
ALTER TABLE portal_nachrichten ADD CONSTRAINT portal_nachrichten_text_chk
  CHECK (length(btrim(betreff)) > 0 AND length(btrim(text)) > 0 AND length(text) <= 5000);
--> statement-breakpoint
GRANT SELECT, INSERT ON portal_nachrichten TO vermieteros_app;
--> statement-breakpoint

-- Tokens und Sitzungen: keine Rechte für App und Worker. Nur die Funktionen unten.
REVOKE ALL ON portal_tokens, portal_sitzungen FROM PUBLIC;
--> statement-breakpoint

/*
 * Login anfordern: legt für jeden aktiven Zugang der Adresse einen Einmal-Token an (Hash vom
 * Aufrufer, je Zugang ein eigener) und liefert die Zugänge zurück. Höchstens 5 Tokens je Zugang
 * in 15 Minuten; darüber wird still nichts angelegt (keine Auskunft, ob die Adresse existiert).
 */
CREATE FUNCTION portal_zugaenge_zur_adresse(p_email text)
RETURNS TABLE (zugang_id uuid, mandant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT z.id, z.mandant_id FROM portal_zugaenge z
  WHERE z.email = lower(btrim(p_email)) AND z.widerrufen_am IS NULL
  ORDER BY z.erstellt_am
$$;
--> statement-breakpoint
CREATE FUNCTION portal_token_anlegen(p_zugang uuid, p_hash text, p_minuten int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
BEGIN
  IF p_minuten NOT BETWEEN 1 AND 10080 THEN
    RAISE EXCEPTION 'Gültigkeit außerhalb 1 Minute bis 7 Tage';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('portal-token:' || p_zugang::text));
  -- Mit Mandantenkontext (Einladung durch den Vermieter) nur Zugänge des eigenen Mandanten;
  -- ohne Kontext (Anmeldung per Adresse) geht der Link nur an die hinterlegte Adresse.
  IF NOT EXISTS (SELECT 1 FROM portal_zugaenge WHERE id = p_zugang AND widerrufen_am IS NULL
                 AND (aktueller_mandant() IS NULL OR mandant_id = aktueller_mandant())) THEN
    RETURN false;
  END IF;
  IF (SELECT count(*) FROM portal_tokens
      WHERE zugang_id = p_zugang AND erstellt_am > now() - interval '15 minutes') >= 5 THEN
    RETURN false;
  END IF;
  INSERT INTO portal_tokens (hash, zugang_id, ablauf_am)
  VALUES (p_hash, p_zugang, now() + make_interval(mins => p_minuten));
  RETURN true;
END $$;
--> statement-breakpoint
/* Token einlösen: genau einmal, vor Ablauf, nur für aktive Zugänge; legt die Sitzung an. */
CREATE FUNCTION portal_token_einloesen(p_token_hash text, p_sitzung_hash text, p_tage int)
RETURNS TABLE (zugang_id uuid, mandant_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_zugang uuid;
BEGIN
  UPDATE portal_tokens t SET verwendet_am = now()
  WHERE t.hash = p_token_hash AND t.verwendet_am IS NULL AND t.ablauf_am > now()
  RETURNING t.zugang_id INTO v_zugang;
  IF v_zugang IS NULL THEN RETURN; END IF;
  IF NOT EXISTS (SELECT 1 FROM portal_zugaenge z WHERE z.id = v_zugang AND z.widerrufen_am IS NULL) THEN
    RETURN;
  END IF;
  INSERT INTO portal_sitzungen (hash, zugang_id, ablauf_am)
  VALUES (p_sitzung_hash, v_zugang, now() + make_interval(days => p_tage));
  RETURN QUERY SELECT z.id, z.mandant_id FROM portal_zugaenge z WHERE z.id = v_zugang;
END $$;
--> statement-breakpoint
/* Sitzung prüfen: gültig, nicht beendet, Zugang nicht widerrufen. */
CREATE FUNCTION portal_sitzung_lesen(p_hash text)
RETURNS TABLE (zugang_id uuid, mandant_id uuid, mietverhaeltnis_id uuid, person_id uuid, email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT z.id, z.mandant_id, z.mietverhaeltnis_id, z.person_id, z.email
  FROM portal_sitzungen s JOIN portal_zugaenge z ON z.id = s.zugang_id
  WHERE s.hash = p_hash AND s.beendet_am IS NULL AND s.ablauf_am > now() AND z.widerrufen_am IS NULL
$$;
--> statement-breakpoint
CREATE FUNCTION portal_abmelden(p_hash text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public, pg_temp AS $$
  UPDATE portal_sitzungen SET beendet_am = now() WHERE hash = p_hash AND beendet_am IS NULL
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION portal_zugaenge_zur_adresse(text), portal_token_anlegen(uuid, text, int),
  portal_token_einloesen(text, text, int), portal_sitzung_lesen(text), portal_abmelden(text) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION portal_zugaenge_zur_adresse(text), portal_token_anlegen(uuid, text, int),
  portal_token_einloesen(text, text, int), portal_sitzung_lesen(text), portal_abmelden(text)
TO vermieteros_app;
