-- Handwerker mit Anschrift und Webseite (Firmensuche): Sicht neu aufbauen, Rechte wie in 0020.
SELECT aktuell_sicht_neu('handwerker', 'handwerker_versionen', 'handwerker_id');
--> statement-breakpoint
GRANT SELECT ON handwerker_aktuell TO vermieteros_worker;
