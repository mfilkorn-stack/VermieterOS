-- Belegeingang und Journal (WP 1.8): RLS, append-only, Bezüge, Belegnummer, Summenprüfung.

-- Belege dürfen ohne Objekt eingehen (belege@, Sammel-Import); alle anderen Dokumente nicht.
ALTER TABLE dokumente DROP CONSTRAINT dokumente_bezug_chk;
--> statement-breakpoint
ALTER TABLE dokumente ADD CONSTRAINT dokumente_bezug_chk
  CHECK (objekt_id IS NOT NULL OR mietverhaeltnis_id IS NOT NULL OR beleg);
--> statement-breakpoint
CREATE TRIGGER dokumente_bezug_ticket BEFORE INSERT ON dokumente
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('ticket_id', 'tickets');
--> statement-breakpoint
CREATE TRIGGER dokumente_bezug_anhang BEFORE INSERT ON dokumente
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('anhang_id', 'anhaenge');
--> statement-breakpoint
-- Ein Mail-Anhang wird höchstens einmal zum Beleg (der Worker läuft nach einem Abbruch erneut).
CREATE UNIQUE INDEX dokumente_beleg_anhang_uq ON dokumente (anhang_id) WHERE beleg AND anhang_id IS NOT NULL;
--> statement-breakpoint

ALTER TABLE postfaecher ADD CONSTRAINT postfaecher_zweck_chk CHECK (zweck IN ('post', 'belege'));
--> statement-breakpoint

SELECT rls_einrichten('journal_eintraege');
--> statement-breakpoint
SELECT rls_einrichten('journal_anteile');
--> statement-breakpoint
SELECT append_only_einrichten('journal_eintraege');
--> statement-breakpoint
SELECT append_only_einrichten('journal_anteile');
--> statement-breakpoint

CREATE TRIGGER journal_eintraege_bezug_dokument BEFORE INSERT ON journal_eintraege
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('dokument_id', 'dokumente');
--> statement-breakpoint
CREATE TRIGGER journal_eintraege_bezug_ticket BEFORE INSERT ON journal_eintraege
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('ticket_id', 'tickets');
--> statement-breakpoint
CREATE TRIGGER journal_eintraege_bezug_vorschlag BEFORE INSERT ON journal_eintraege
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('vorschlag_id', 'ki_vorschlaege');
--> statement-breakpoint
CREATE TRIGGER journal_anteile_bezug_eintrag BEFORE INSERT ON journal_anteile
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('eintrag_id', 'journal_eintraege');
--> statement-breakpoint
CREATE TRIGGER journal_anteile_bezug_objekt BEFORE INSERT ON journal_anteile
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('objekt_id', 'objekte');
--> statement-breakpoint
CREATE TRIGGER journal_anteile_bezug_einheit BEFORE INSERT ON journal_anteile
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('einheit_id', 'einheiten');
--> statement-breakpoint

ALTER TABLE journal_eintraege ADD CONSTRAINT journal_richtung_chk
  CHECK (richtung IN ('ausgabe', 'einnahme'));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_kategorie_chk CHECK (
  (richtung = 'einnahme' AND steuerkategorie IN ('mieteinnahmen', 'umlagen', 'sonstige_einnahmen'))
  OR (richtung = 'ausgabe' AND steuerkategorie IN ('erhaltungsaufwand', 'betriebskosten',
    'verwaltungskosten', 'schuldzinsen', 'geldbeschaffungskosten', 'sonstige_werbungskosten',
    'herstellungskosten', 'anschaffungskosten', 'nicht_abziehbar')));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_betrag_chk CHECK (
  brutto_cent > 0 AND (umsatzsteuer_cent IS NULL OR (umsatzsteuer_cent >= 0 AND umsatzsteuer_cent < brutto_cent)));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_verteilung_chk CHECK (
  verteilung_jahre IS NULL OR (steuerkategorie = 'erhaltungsaufwand' AND verteilung_jahre BETWEEN 2 AND 5));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_umlage_chk CHECK (
  (kostenart IS NULL OR steuerkategorie = 'betriebskosten')
  AND (NOT umlagefaehig OR (kostenart IS NOT NULL AND leistung_von IS NOT NULL)));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_leistung_chk CHECK (
  (leistung_von IS NULL) = (leistung_bis IS NULL) AND (leistung_von IS NULL OR leistung_von <= leistung_bis));
--> statement-breakpoint
ALTER TABLE journal_eintraege ADD CONSTRAINT journal_text_chk CHECK (length(btrim(gegenpartei)) > 0);
--> statement-breakpoint
ALTER TABLE journal_anteile ADD CONSTRAINT journal_anteil_betrag_chk CHECK (betrag_cent > 0);
--> statement-breakpoint

-- Laufende Nummer je Mandant und Zahlungsjahr; ein Beleg ist höchstens einmal gültig gebucht.
CREATE FUNCTION journal_vor_insert() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_jahr int := EXTRACT(YEAR FROM NEW.zahlungsdatum)::int;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('journal:' || NEW.mandant_id::text || ':' || v_jahr));
  SELECT COALESCE(max(lfd_nr), 0) + 1 INTO NEW.lfd_nr
    FROM journal_eintraege WHERE mandant_id = NEW.mandant_id AND jahr = v_jahr;
  IF NEW.dokument_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtext('beleg:' || NEW.dokument_id::text));
    IF EXISTS (
      SELECT 1 FROM journal_eintraege e
      WHERE e.dokument_id = NEW.dokument_id
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = e.id)
    ) THEN
      RAISE EXCEPTION 'Beleg % ist bereits gebucht', NEW.dokument_id
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER journal_eintraege_vor_insert BEFORE INSERT ON journal_eintraege
FOR EACH ROW EXECUTE FUNCTION journal_vor_insert();
--> statement-breakpoint

-- Am Ende der Transaktion: Anteile ergeben genau den Bruttobetrag, mindestens ein Anteil.
CREATE FUNCTION journal_summe_pruefen() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  -- Ein Trigger für beide Tabellen: Anteile tragen eintrag_id, Einträge nur id.
  v_id     uuid := COALESCE((to_jsonb(NEW)->>'eintrag_id')::uuid, NEW.id);
  v_brutto bigint;
  v_summe  bigint;
BEGIN
  SELECT brutto_cent INTO v_brutto FROM journal_eintraege WHERE id = v_id;
  SELECT COALESCE(sum(betrag_cent), 0) INTO v_summe FROM journal_anteile WHERE eintrag_id = v_id;
  IF v_summe <> v_brutto THEN
    RAISE EXCEPTION 'Journaleintrag %: Anteile (%) ergeben nicht den Bruttobetrag (%)', v_id, v_summe, v_brutto
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_eintraege_summe AFTER INSERT ON journal_eintraege
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_summe_pruefen();
--> statement-breakpoint
CREATE CONSTRAINT TRIGGER journal_anteile_summe AFTER INSERT ON journal_anteile
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION journal_summe_pruefen();
--> statement-breakpoint

CREATE VIEW journal_gueltig WITH (security_invoker = true) AS
SELECT e.*
FROM journal_eintraege e
WHERE NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = e.id);
--> statement-breakpoint

GRANT SELECT, INSERT ON journal_eintraege, journal_anteile TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT ON journal_gueltig TO vermieteros_app;
--> statement-breakpoint

-- Worker: Belege aus der belege@-Adresse ablegen und für die KI lesen; keine Buchungen.
GRANT SELECT, INSERT ON dokumente, dokument_versionen TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT ON dokumente_aktuell, tickets, ticket_versionen, tickets_aktuell,
  journal_eintraege, journal_anteile, journal_gueltig
TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT (zweck) ON postfaecher TO vermieteros_app;
