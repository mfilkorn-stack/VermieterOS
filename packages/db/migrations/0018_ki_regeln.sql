-- KI-Vorschläge (WP 1.4, PLAN 4.2): Mandantentrennung, append-only, Status als Sicht.

SELECT rls_einrichten('ki_vorschlaege');
--> statement-breakpoint
SELECT rls_einrichten('ki_vorschlag_entscheidungen');
--> statement-breakpoint
SELECT append_only_einrichten('ki_vorschlaege');
--> statement-breakpoint
SELECT append_only_einrichten('ki_vorschlag_entscheidungen');
--> statement-breakpoint
CREATE TRIGGER ki_entscheidung_bezug BEFORE INSERT ON ki_vorschlag_entscheidungen
FOR EACH ROW EXECUTE FUNCTION bezug_mandant_pruefen('vorschlag_id', 'ki_vorschlaege');
--> statement-breakpoint
ALTER TABLE ki_vorschlag_entscheidungen ADD CONSTRAINT ki_entscheidung_status_chk
  CHECK (status IN ('bestaetigt', 'verworfen', 'veraltet'));
--> statement-breakpoint
ALTER TABLE ki_vorschlaege ADD CONSTRAINT ki_vorschlaege_ablauf_chk CHECK (ablauf_am > erfasst_am);
--> statement-breakpoint
-- Bestätigen ist eine menschliche Entscheidung; das System darf nur verwerfen oder veralten lassen.
ALTER TABLE ki_vorschlag_entscheidungen ADD CONSTRAINT ki_entscheidung_akteur_chk
  CHECK (status <> 'bestaetigt' OR akteur_art = 'nutzer');
--> statement-breakpoint

-- Status: Entscheidung, sonst abgelaufen = veraltet, sonst offen.
CREATE VIEW ki_vorschlaege_aktuell WITH (security_invoker = true) AS
SELECT v.*,
       coalesce(e.status, CASE WHEN v.ablauf_am <= now() THEN 'veraltet' ELSE 'offen' END) AS status,
       e.grund AS entscheidung_grund,
       e.erfasst_am AS entschieden_am
FROM ki_vorschlaege v
LEFT JOIN ki_vorschlag_entscheidungen e ON e.vorschlag_id = v.id;
--> statement-breakpoint

GRANT SELECT, INSERT ON ki_vorschlaege, ki_vorschlag_entscheidungen TO vermieteros_app;
--> statement-breakpoint
GRANT SELECT ON ki_vorschlaege_aktuell TO vermieteros_app;
--> statement-breakpoint
-- Der Worker erzeugt später Vorschläge im Hintergrund (Sortierung, WP 1.5); entscheiden darf er nicht.
GRANT SELECT, INSERT ON ki_vorschlaege TO vermieteros_worker;
--> statement-breakpoint
GRANT SELECT ON ki_vorschlag_entscheidungen, ki_vorschlaege_aktuell TO vermieteros_worker;
