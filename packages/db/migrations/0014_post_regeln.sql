-- Mail-Eingang (WP 1.1): Mandantentrennung, Schreibschutz, Worker-Rolle, Sicht der aktuellen Zuordnung.

-- Worker-Rolle: findet Postfächer aller Mandanten, alles andere nur im Mandantenkontext wie die App.
-- LOGIN und Passwort setzt der Betrieb (ops/postgres-init.sh); hier nur sicherstellen.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vermieteros_worker') THEN
    CREATE ROLE vermieteros_worker NOLOGIN NOBYPASSRLS;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO vermieteros_worker;
--> statement-breakpoint

SELECT rls_einrichten('postfaecher');
--> statement-breakpoint
SELECT rls_einrichten('nachrichten');
--> statement-breakpoint
SELECT rls_einrichten('anhaenge');
--> statement-breakpoint
SELECT rls_einrichten('nachricht_zuordnungen');
--> statement-breakpoint
-- Zusätzliche Policy nur für den Worker: Postfächer aller Mandanten sehen (nicht ändern).
CREATE POLICY postfaecher_worker_lesen ON postfaecher FOR SELECT TO vermieteros_worker USING (true);
--> statement-breakpoint

SELECT append_only_einrichten('nachrichten');
--> statement-breakpoint
SELECT append_only_einrichten('anhaenge');
--> statement-breakpoint
SELECT append_only_einrichten('nachricht_zuordnungen');
--> statement-breakpoint
CREATE TRIGGER postfaecher_kein_delete BEFORE DELETE ON postfaecher
FOR EACH ROW EXECUTE FUNCTION verhindere_loeschen();
--> statement-breakpoint

-- Verweise nur innerhalb des Mandanten (Fremdschlüssel-Prüfungen umgehen RLS).
CREATE TRIGGER nachrichten_bezug_postfach BEFORE INSERT ON nachrichten
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('postfach_id', 'postfaecher');
--> statement-breakpoint
CREATE TRIGGER anhaenge_bezug_nachricht BEFORE INSERT ON anhaenge
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('nachricht_id', 'nachrichten');
--> statement-breakpoint
CREATE TRIGGER nachricht_zuordnungen_bezug_nachricht BEFORE INSERT ON nachricht_zuordnungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('nachricht_id', 'nachrichten');
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_mv_fk
  FOREIGN KEY (mietverhaeltnis_id) REFERENCES mietverhaeltnisse(id);
--> statement-breakpoint
CREATE TRIGGER nachricht_zuordnungen_bezug_mv BEFORE INSERT ON nachricht_zuordnungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('mietverhaeltnis_id', 'mietverhaeltnisse');
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_art_chk CHECK (
  (art = 'aufgehoben' AND mietverhaeltnis_id IS NULL) OR (art <> 'aufgehoben' AND mietverhaeltnis_id IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE nachricht_zuordnungen ADD CONSTRAINT nachricht_zuordnungen_manuell_chk CHECK (
  art NOT IN ('manuell', 'aufgehoben') OR akteur_art = 'nutzer'
);
--> statement-breakpoint

-- Aktuelle Zuordnung: jüngster Eintrag je Nachricht. Nachrichten ohne Eintrag sind offen.
CREATE VIEW nachrichten_zuordnung_aktuell WITH (security_invoker = true) AS
SELECT DISTINCT ON (z.nachricht_id)
  z.nachricht_id, z.mandant_id, z.mietverhaeltnis_id, z.art, z.begruendung, z.akteur_art, z.akteur_id, z.erfasst_am
FROM nachricht_zuordnungen z
ORDER BY z.nachricht_id, z.erfasst_am DESC, z.id DESC;
--> statement-breakpoint

-- App: Postfächer ohne Lesezugriff auf das verschlüsselte Passwort.
GRANT SELECT (id, mandant_id, bezeichnung, host, port, tls, benutzer, ordner, abruf_ab, aktiv,
              uid_validity, letzte_uid, letzter_abruf, letzter_fehler, angelegt_am) ON postfaecher TO vermieteros_app;
--> statement-breakpoint
GRANT INSERT, UPDATE ON postfaecher TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT, INSERT ON nachrichten, anhaenge, nachricht_zuordnungen TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT ON nachrichten_zuordnung_aktuell TO vermieteros_app;
--> statement-breakpoint

-- Worker: Postfach-Zustand fortschreiben, Nachrichten ablegen, Zuordnungskandidaten lesen. Keine Stammdaten schreiben.
GRANT SELECT, UPDATE ON postfaecher TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON nachrichten, anhaenge, nachricht_zuordnungen, ereignisse TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT ON nachrichten_zuordnung_aktuell, mandanten,
  personen, person_versionen, personen_aktuell,
  mietverhaeltnisse, mietverhaeltnis_versionen, mietverhaeltnisse_aktuell,
  einheiten, einheit_versionen, einheiten_aktuell,
  objekte, objekt_versionen, objekte_aktuell, stornos
TO vermieteros_worker;
