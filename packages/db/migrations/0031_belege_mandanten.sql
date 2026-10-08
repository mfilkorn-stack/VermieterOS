-- Worker: Mandanten mit neuen Dokumenten finden, auch ohne Postfach (Belege per Upload).
-- Liefert nur Mandanten-IDs; das Auslesen selbst läuft danach im Mandantenkontext mit RLS.
CREATE FUNCTION mandanten_mit_neuen_dokumenten(p_seit_tagen int)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
  SELECT DISTINCT d.mandant_id FROM dokumente d
  WHERE d.erstellt_am > now() - make_interval(days => p_seit_tagen)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION mandanten_mit_neuen_dokumenten(int) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION mandanten_mit_neuen_dokumenten(int) TO vermieteros_worker;
