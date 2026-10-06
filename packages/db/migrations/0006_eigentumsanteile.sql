CREATE TABLE "eigentumsanteil_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"eigentumsanteil_id" uuid NOT NULL,
	"zaehler" integer NOT NULL,
	"nenner" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eigentumsanteile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"person_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eigentumsanteil_versionen" ADD CONSTRAINT "eigentumsanteil_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eigentumsanteil_versionen" ADD CONSTRAINT "eigentumsanteil_versionen_eigentumsanteil_id_eigentumsanteile_id_fk" FOREIGN KEY ("eigentumsanteil_id") REFERENCES "public"."eigentumsanteile"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eigentumsanteile" ADD CONSTRAINT "eigentumsanteile_person_id_personen_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eigentumsanteil_versionen_nr_uq" ON "eigentumsanteil_versionen" USING btree ("eigentumsanteil_id","version_nr");