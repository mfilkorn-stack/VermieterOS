-- Referenzdaten (WP 0.7): Regeln, Rechte, Seed Grunderwerbsteuer.

-- Sicht der Objekte neu aufbauen (neue Spalte `bundesland`).
SELECT aktuell_sicht_neu('objekte', 'objekt_versionen', 'objekt_id');
--> statement-breakpoint

ALTER TABLE referenzdaten ADD CONSTRAINT referenzdaten_zeitraum_chk
  CHECK (gueltig_bis IS NULL OR gueltig_bis >= gueltig_von);
--> statement-breakpoint
ALTER TABLE referenzdaten ADD CONSTRAINT referenzdaten_pruefung_chk
  CHECK (pruefen_bis >= geprueft_am);
--> statement-breakpoint
SELECT append_only_einrichten('referenzdaten');
--> statement-breakpoint

-- RLS ohne FORCE: Die Besitzerrolle pflegt globale Werte per Migration. Die App-Rolle sieht
-- globale und eigene Werte und darf nur eigene anlegen.
ALTER TABLE referenzdaten ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY referenzdaten_lesen ON referenzdaten FOR SELECT
  USING (mandant_id IS NULL OR mandant_id = aktueller_mandant());
--> statement-breakpoint
CREATE POLICY referenzdaten_anlegen ON referenzdaten FOR INSERT
  WITH CHECK (mandant_id = aktueller_mandant());
--> statement-breakpoint
GRANT SELECT, INSERT ON referenzdaten TO vermieteros_app;
--> statement-breakpoint

-- Grunderwerbsteuer je Land. Maßgeblich ist das Datum des notariellen Kaufvertrags.
-- Geprüft am 06.10.2026 gegen mehrere aktuelle Übersichten; Bremen gegen das Gesetzblatt.
-- Wo der Beginn eines älteren Satzes nur aus einer Quelle stammt, steht ein Hinweis.
INSERT INTO referenzdaten (id, art, schluessel, wert, gueltig_von, gueltig_bis, quelle, quelle_url, hinweis, geprueft_am, pruefen_bis, erfasst_von)
SELECT gen_random_uuid(), 'grunderwerbsteuer', s.land, jsonb_build_object('satzPromille', s.promille),
       s.von::date, s.bis::date, s.quelle, s.url, s.hinweis, DATE '2026-10-06', DATE '2027-10-06', 'migration:0012'
FROM (VALUES
  ('BW', 50, '2011-11-05', NULL, 'Landesrecht Baden-Württemberg; Abgleich aktueller Übersichten', NULL, NULL),
  ('BY', 35, '1997-01-01', NULL, '§ 11 Abs. 1 GrEStG (Bayern ohne eigene Festsetzung)', NULL, NULL),
  ('BE', 60, '2014-01-01', NULL, 'Landesrecht Berlin; Abgleich aktueller Übersichten', NULL, NULL),
  ('BB', 65, '2015-07-01', NULL, 'Landesrecht Brandenburg; Abgleich aktueller Übersichten', NULL, NULL),
  ('HB', 50, '2014-01-01', '2025-06-30', 'Landesrecht Bremen; Abgleich aktueller Übersichten', NULL, NULL),
  ('HB', 55, '2025-07-01', NULL, 'Brem.GBl. 2025 Nr. 9 (Änderung des Grunderwerbsteuersatzes)',
     'https://www.gesetzblatt.bremen.de/fastmedia/218/2025_02_05_GBl_Nr_0009_signed.pdf', NULL),
  ('HH', 45, '2009-01-01', '2022-12-31', 'Landesrecht Hamburg; Abgleich aktueller Übersichten', NULL,
     'Beginn 2009 nicht aus Primärquelle bestätigt'),
  ('HH', 55, '2023-01-01', NULL, 'Landesrecht Hamburg; Abgleich aktueller Übersichten', NULL, NULL),
  ('HE', 60, '2014-08-01', NULL, 'Landesrecht Hessen; Abgleich aktueller Übersichten', NULL, NULL),
  ('MV', 50, '2012-07-01', '2019-06-30', 'Landesrecht Mecklenburg-Vorpommern; Abgleich aktueller Übersichten', NULL,
     'Beginn 2012 nicht aus Primärquelle bestätigt'),
  ('MV', 60, '2019-07-01', NULL, 'Landesrecht Mecklenburg-Vorpommern; Abgleich aktueller Übersichten', NULL, NULL),
  ('NI', 50, '2014-01-01', NULL, 'Landesrecht Niedersachsen; Abgleich aktueller Übersichten', NULL,
     'Beginn 2014 nicht aus Primärquelle bestätigt'),
  ('NW', 65, '2015-01-01', NULL, 'Landesrecht Nordrhein-Westfalen; Abgleich aktueller Übersichten', NULL, NULL),
  ('RP', 50, '2012-03-01', NULL, 'Landesrecht Rheinland-Pfalz; Abgleich aktueller Übersichten', NULL,
     'Beginn 2012 nicht aus Primärquelle bestätigt'),
  ('SL', 65, '2015-01-01', NULL, 'Landesrecht Saarland; Abgleich aktueller Übersichten', NULL, NULL),
  ('SN', 35, '1997-01-01', '2022-12-31', '§ 11 Abs. 1 GrEStG (Sachsen ohne eigene Festsetzung bis 2022)', NULL, NULL),
  ('SN', 55, '2023-01-01', NULL, 'Landesrecht Sachsen; Abgleich aktueller Übersichten', NULL, NULL),
  ('ST', 50, '2012-03-01', NULL, 'Landesrecht Sachsen-Anhalt; Abgleich aktueller Übersichten', NULL,
     'Beginn 2012 nicht aus Primärquelle bestätigt'),
  ('SH', 65, '2014-01-01', NULL, 'Landesrecht Schleswig-Holstein; Abgleich aktueller Übersichten', NULL, NULL),
  ('TH', 65, '2017-01-01', '2023-12-31', 'Landesrecht Thüringen; Abgleich aktueller Übersichten', NULL,
     'Beginn 2017 nicht aus Primärquelle bestätigt'),
  ('TH', 50, '2024-01-01', NULL, 'Landesrecht Thüringen; Abgleich aktueller Übersichten', NULL, NULL)
) AS s(land, promille, von, bis, quelle, url, hinweis);
