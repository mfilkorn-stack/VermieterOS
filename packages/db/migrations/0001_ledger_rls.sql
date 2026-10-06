-- Ledger-Kern, Schreibschutz, Mandantentrennung, Versionsmuster.
-- Siehe docs/PLAN.md Kapitel 3 und ADR 0003. Diese Migration wird nie geändert, nur ergänzt.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Rollen. Die App-Rolle wird hier nur sichergestellt (NOLOGIN); LOGIN und Passwort
-- setzt der Betrieb (docker/init-roles.sql bzw. Coolify-Secret).
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vermieteros_app') THEN
    CREATE ROLE vermieteros_app NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO vermieteros_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Mandantenkontext. Ohne gesetzten Wert: NULL, damit jede Policy fehlschlägt.
-- ---------------------------------------------------------------------------
CREATE FUNCTION aktueller_mandant() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.mandant_id', true), '')::uuid
$$;
--> statement-breakpoint

CREATE FUNCTION rls_einrichten(p_tabelle regclass, p_spalte text DEFAULT 'mandant_id') RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', p_tabelle);
  EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', p_tabelle);
  EXECUTE format(
    'CREATE POLICY mandant_isolation ON %s USING (%I = aktueller_mandant()) WITH CHECK (%I = aktueller_mandant())',
    p_tabelle, p_spalte, p_spalte
  );
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Schreibschutz: append-only Tabellen werfen bei UPDATE/DELETE, zusätzlich zum fehlenden Recht.
-- ---------------------------------------------------------------------------
CREATE FUNCTION verhindere_aenderung() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabelle % ist append-only: % nicht erlaubt (Storno statt Löschen)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'integrity_constraint_violation';
END $$;
--> statement-breakpoint

CREATE FUNCTION append_only_einrichten(p_tabelle regclass) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE format(
    'CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %s FOR EACH ROW EXECUTE FUNCTION verhindere_aenderung()',
    p_tabelle::text || '_append_only', p_tabelle
  );
END $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Ledger: Hash-Kette pro Mandant, berechnet im Trigger, nicht in der Anwendung.
-- ---------------------------------------------------------------------------
CREATE FUNCTION ereignis_hash_eingabe(e ereignisse) RETURNS text
LANGUAGE sql STABLE AS $$
  SELECT concat_ws('|',
    e.prev_hash,
    e.mandant_id::text,
    e.seq::text,
    e.typ,
    coalesce(e.entitaet, ''),
    coalesce(e.entitaet_id::text, ''),
    coalesce(e.version_id::text, ''),
    e.akteur_art,
    e.akteur_id,
    to_char(e.erfasst_am AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"'),
    e.payload::text
  )
$$;
--> statement-breakpoint

CREATE FUNCTION ereignis_vor_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_seq  bigint;
  v_hash text;
BEGIN
  -- Anhängen pro Mandant serialisieren, damit seq lückenlos und die Kette eindeutig bleibt.
  PERFORM pg_advisory_xact_lock(hashtext('ereignisse:' || NEW.mandant_id::text));

  SELECT e.seq, e.hash INTO v_seq, v_hash
  FROM ereignisse e
  WHERE e.mandant_id = NEW.mandant_id
  ORDER BY e.seq DESC
  LIMIT 1;

  NEW.seq       := coalesce(v_seq, 0) + 1;
  NEW.prev_hash := coalesce(v_hash, repeat('0', 64));
  NEW.erfasst_am := clock_timestamp();
  NEW.hash      := encode(digest(ereignis_hash_eingabe(NEW), 'sha256'), 'hex');
  RETURN NEW;
END $$;
--> statement-breakpoint

CREATE TRIGGER ereignisse_vor_insert BEFORE INSERT ON ereignisse
FOR EACH ROW EXECUTE FUNCTION ereignis_vor_insert();
--> statement-breakpoint

-- Kettenprüfung. Läuft nächtlich pro Mandant und nach jedem Restore.
CREATE FUNCTION ledger_pruefe_kette(p_mandant_id uuid)
RETURNS TABLE (ok boolean, geprueft bigint, erster_fehler_seq bigint, fehler text)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  r      ereignisse;
  v_prev text   := repeat('0', 64);
  v_n    bigint := 0;
BEGIN
  FOR r IN SELECT * FROM ereignisse e WHERE e.mandant_id = p_mandant_id ORDER BY e.seq LOOP
    IF r.seq <> v_n + 1 THEN
      RETURN QUERY SELECT false, v_n, r.seq, 'Lücke in seq'::text; RETURN;
    END IF;
    IF r.prev_hash <> v_prev THEN
      RETURN QUERY SELECT false, v_n, r.seq, 'prev_hash passt nicht zum Vorgänger'::text; RETURN;
    END IF;
    IF r.hash <> encode(digest(ereignis_hash_eingabe(r), 'sha256'), 'hex') THEN
      RETURN QUERY SELECT false, v_n, r.seq, 'hash passt nicht zum Inhalt'::text; RETURN;
    END IF;
    v_prev := r.hash;
    v_n := v_n + 1;
  END LOOP;
  RETURN QUERY SELECT true, v_n, NULL::bigint, NULL::text;
END $$;
--> statement-breakpoint

SELECT append_only_einrichten('ereignisse');
--> statement-breakpoint
SELECT rls_einrichten('ereignisse');
--> statement-breakpoint
GRANT SELECT, INSERT ON ereignisse TO vermieteros_app;
--> statement-breakpoint

SELECT append_only_einrichten('stornos');
--> statement-breakpoint
SELECT rls_einrichten('stornos');
--> statement-breakpoint
GRANT SELECT, INSERT ON stornos TO vermieteros_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Mandanten: Stammsatz. Policy auf id statt mandant_id. Kein DELETE.
-- ---------------------------------------------------------------------------
SELECT rls_einrichten('mandanten', 'id');
--> statement-breakpoint
CREATE FUNCTION verhindere_loeschen() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tabelle % erlaubt kein DELETE', TG_TABLE_NAME USING ERRCODE = 'integrity_constraint_violation';
END $$;
--> statement-breakpoint
CREATE TRIGGER mandanten_kein_delete BEFORE DELETE ON mandanten
FOR EACH ROW EXECUTE FUNCTION verhindere_loeschen();
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON mandanten TO vermieteros_app;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Versionsmuster (ADR 0003). Ein Aufruf pro Entität richtet ein:
--   * append-only auf Identität und Versionen
--   * Pflicht-Begründung ab Version 2
--   * Mandant der Version = Mandant der Identität (RI-Prüfungen umgehen RLS, deshalb Trigger)
--   * Sicht <identitaet>_aktuell (security_invoker, damit RLS des Aufrufers gilt)
--   * Funktion <entitaet>_stand(id, stichtag, erfasst_bis): beide Zeitachsen frei wählbar
--   * RLS und Rechte
-- ---------------------------------------------------------------------------
CREATE FUNCTION version_mandant_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_fk      text := TG_ARGV[0];
  v_ident   text := TG_ARGV[1];
  v_id      uuid;
  v_mandant uuid;
BEGIN
  EXECUTE format('SELECT ($1).%I', v_fk) INTO v_id USING NEW;
  EXECUTE format('SELECT mandant_id FROM %I WHERE id = $1', v_ident) INTO v_mandant USING v_id;
  IF v_mandant IS NULL OR v_mandant <> NEW.mandant_id THEN
    RAISE EXCEPTION 'Version gehört nicht zum Mandanten der Identität (%.%)', v_ident, v_id
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint

CREATE FUNCTION versionierung_einrichten(
  p_entitaet   text,       -- z. B. 'objekt'  → Funktion objekt_stand()
  p_identitaet regclass,   -- z. B. 'objekte' → Sicht objekte_aktuell
  p_versionen  regclass,   -- z. B. 'objekt_versionen'
  p_fk         text        -- z. B. 'objekt_id'
) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  ident text := p_identitaet::text;
  vers  text := p_versionen::text;
BEGIN
  PERFORM append_only_einrichten(p_identitaet);
  PERFORM append_only_einrichten(p_versionen);

  EXECUTE format(
    'ALTER TABLE %s ADD CONSTRAINT %I CHECK (version_nr = 1 OR (begruendung IS NOT NULL AND length(btrim(begruendung)) > 0))',
    vers, vers || '_begruendung_chk'
  );

  EXECUTE format(
    'CREATE TRIGGER %I BEFORE INSERT ON %s FOR EACH ROW EXECUTE FUNCTION version_mandant_pruefen(%L, %L)',
    vers || '_mandant_chk', vers, p_fk, ident
  );

  EXECUTE format($v$
    CREATE VIEW %I WITH (security_invoker = true) AS
      SELECT DISTINCT ON (v.%I) v.*
      FROM %s v
      WHERE v.gueltig_ab <= current_date
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
      ORDER BY v.%I, v.gueltig_ab DESC, v.erfasst_am DESC, v.version_nr DESC
  $v$, ident || '_aktuell', p_fk, vers, p_fk);

  EXECUTE format($f$
    CREATE FUNCTION %I(p_id uuid, p_stichtag date, p_erfasst_bis timestamptz DEFAULT now())
    RETURNS SETOF %s
    LANGUAGE sql STABLE AS $body$
      SELECT v.*
      FROM %s v
      WHERE v.%I = p_id
        AND v.gueltig_ab <= p_stichtag
        AND v.erfasst_am <= p_erfasst_bis
        AND NOT EXISTS (
          SELECT 1 FROM stornos s WHERE s.version_id = v.id AND s.erfasst_am <= p_erfasst_bis
        )
      ORDER BY v.gueltig_ab DESC, v.erfasst_am DESC, v.version_nr DESC
      LIMIT 1
    $body$
  $f$, p_entitaet || '_stand', vers, vers, p_fk);

  PERFORM rls_einrichten(p_identitaet);
  PERFORM rls_einrichten(p_versionen);

  EXECUTE format('GRANT SELECT, INSERT ON %s TO vermieteros_app', ident);
  EXECUTE format('GRANT SELECT, INSERT ON %s TO vermieteros_app', vers);
  EXECUTE format('GRANT SELECT ON %I TO vermieteros_app', ident || '_aktuell');
END $$;
--> statement-breakpoint

SELECT versionierung_einrichten('objekt', 'objekte', 'objekt_versionen', 'objekt_id');
--> statement-breakpoint
SELECT versionierung_einrichten('einheit', 'einheiten', 'einheit_versionen', 'einheit_id');
