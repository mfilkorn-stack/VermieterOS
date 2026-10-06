-- Versionsmuster, Schreibschutz und RLS für die restlichen Stammdaten-Entitäten (WP 0.4).
SELECT versionierung_einrichten('person', 'personen', 'person_versionen', 'person_id');
--> statement-breakpoint
SELECT versionierung_einrichten('mietverhaeltnis', 'mietverhaeltnisse', 'mietverhaeltnis_versionen', 'mietverhaeltnis_id');
--> statement-breakpoint
SELECT versionierung_einrichten('mietkondition', 'mietkonditionen', 'mietkondition_versionen', 'mietkondition_id');
--> statement-breakpoint
SELECT versionierung_einrichten('zaehler', 'zaehler', 'zaehler_versionen', 'zaehler_id');
--> statement-breakpoint
SELECT versionierung_einrichten('darlehen', 'darlehen', 'darlehen_versionen', 'darlehen_id');
--> statement-breakpoint
SELECT versionierung_einrichten('dokument', 'dokumente', 'dokument_versionen', 'dokument_id');
--> statement-breakpoint

-- Ein Dokument hängt am Objekt oder am Mietverhältnis.
ALTER TABLE dokumente ADD CONSTRAINT dokumente_bezug_chk
  CHECK (objekt_id IS NOT NULL OR mietverhaeltnis_id IS NOT NULL);
--> statement-breakpoint

-- Zählerstände: Ereignisse, append-only, Storno über stornos (entitaet = 'zaehlerstand').
SELECT append_only_einrichten('zaehlerstaende');
--> statement-breakpoint
SELECT rls_einrichten('zaehlerstaende');
--> statement-breakpoint
GRANT SELECT, INSERT ON zaehlerstaende TO vermieteros_app;
--> statement-breakpoint

-- Zähler der Ablesung muss zum Mandanten gehören (RI-Prüfungen umgehen RLS).
CREATE TRIGGER zaehlerstaende_mandant_chk BEFORE INSERT ON zaehlerstaende
FOR EACH ROW EXECUTE FUNCTION version_mandant_pruefen('zaehler_id', 'zaehler');
--> statement-breakpoint

CREATE VIEW zaehlerstaende_gueltig WITH (security_invoker = true) AS
  SELECT z.*
  FROM zaehlerstaende z
  WHERE NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = z.id);
--> statement-breakpoint
GRANT SELECT ON zaehlerstaende_gueltig TO vermieteros_app;
