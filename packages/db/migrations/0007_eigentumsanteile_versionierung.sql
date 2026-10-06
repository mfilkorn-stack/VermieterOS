-- Eigentumsanteile pro Mandant (WP 0.5): Versionsmuster, Schreibschutz, RLS.
SELECT versionierung_einrichten('eigentumsanteil', 'eigentumsanteile', 'eigentumsanteil_versionen', 'eigentumsanteil_id');
--> statement-breakpoint
ALTER TABLE eigentumsanteil_versionen ADD CONSTRAINT eigentumsanteil_bruch_chk
  CHECK (nenner > 0 AND zaehler >= 0 AND zaehler <= nenner);
