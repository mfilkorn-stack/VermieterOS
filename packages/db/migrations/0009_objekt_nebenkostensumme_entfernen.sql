-- Nebenkosten stehen jetzt als Positionen in `anschaffungsnebenkosten` (eine Wahrheit, Summe wird gerechnet).
--
-- Die Sichten `*_aktuell` wurden mit `v.*` angelegt; Postgres friert die Spaltenliste beim
-- Anlegen ein. Neue Spalten fehlen deshalb in der Sicht, und DROP COLUMN scheitert an der
-- Abhängigkeit. `aktuell_sicht_neu()` baut eine Sicht nach jeder Schemaänderung neu auf.
CREATE FUNCTION aktuell_sicht_neu(p_identitaet regclass, p_versionen regclass, p_fk text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE
  sicht text := p_identitaet::text || '_aktuell';
BEGIN
  EXECUTE format('DROP VIEW IF EXISTS %I', sicht);
  EXECUTE format($v$
    CREATE VIEW %I WITH (security_invoker = true) AS
      SELECT DISTINCT ON (v.%I) v.*
      FROM %s v
      WHERE v.gueltig_ab <= current_date
        AND NOT EXISTS (SELECT 1 FROM stornos s WHERE s.version_id = v.id)
      ORDER BY v.%I, v.gueltig_ab DESC, v.erfasst_am DESC, v.version_nr DESC
  $v$, sicht, p_fk, p_versionen, p_fk);
  EXECUTE format('GRANT SELECT ON %I TO vermieteros_app', sicht);
END $$;
--> statement-breakpoint
DROP VIEW objekte_aktuell;
--> statement-breakpoint
ALTER TABLE "objekt_versionen" DROP COLUMN "anschaffungsnebenkosten_cent";
--> statement-breakpoint
SELECT aktuell_sicht_neu('objekte', 'objekt_versionen', 'objekt_id');
