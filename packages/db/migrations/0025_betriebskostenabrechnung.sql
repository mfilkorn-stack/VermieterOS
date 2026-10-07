CREATE TABLE "bk_abrechnung_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"bk_abrechnung_id" uuid NOT NULL,
	"zeitraum_von" date NOT NULL,
	"zeitraum_bis" date NOT NULL,
	"positionen" jsonb NOT NULL,
	"messdienst" jsonb,
	"vorauszahlungen" jsonb,
	"status" text DEFAULT 'entwurf' NOT NULL,
	"notizen" text,
	"ergebnis" jsonb
);
--> statement-breakpoint
CREATE TABLE "bk_abrechnungen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"einheit_id" uuid NOT NULL,
	"jahr" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bk_abrechnung_versionen" ADD CONSTRAINT "bk_abrechnung_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bk_abrechnung_versionen" ADD CONSTRAINT "bk_abrechnung_versionen_bk_abrechnung_id_bk_abrechnungen_id_fk" FOREIGN KEY ("bk_abrechnung_id") REFERENCES "public"."bk_abrechnungen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bk_abrechnungen" ADD CONSTRAINT "bk_abrechnungen_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bk_abrechnung_versionen_nr_uq" ON "bk_abrechnung_versionen" USING btree ("bk_abrechnung_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "bk_abrechnungen_einheit_jahr_uq" ON "bk_abrechnungen" USING btree ("einheit_id","jahr");--> statement-breakpoint
CREATE INDEX "bk_abrechnungen_einheit_idx" ON "bk_abrechnungen" USING btree ("einheit_id");