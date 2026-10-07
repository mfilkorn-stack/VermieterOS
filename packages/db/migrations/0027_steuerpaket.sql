CREATE TABLE "steuerpaket_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"steuerpaket_id" uuid NOT NULL,
	"mietausfall_cent" bigint,
	"hausgeld" jsonb,
	"schuldzinsen_cent" bigint,
	"weitere" jsonb,
	"notizen" text,
	"status" text DEFAULT 'entwurf' NOT NULL,
	"ueberschuss_cent" bigint,
	"paket_dokument_id" uuid
);
--> statement-breakpoint
CREATE TABLE "steuerpakete" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL,
	"jahr" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "steuerpaket_versionen" ADD CONSTRAINT "steuerpaket_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steuerpaket_versionen" ADD CONSTRAINT "steuerpaket_versionen_steuerpaket_id_steuerpakete_id_fk" FOREIGN KEY ("steuerpaket_id") REFERENCES "public"."steuerpakete"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steuerpaket_versionen" ADD CONSTRAINT "steuerpaket_versionen_paket_dokument_id_dokumente_id_fk" FOREIGN KEY ("paket_dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "steuerpakete" ADD CONSTRAINT "steuerpakete_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "steuerpaket_versionen_nr_uq" ON "steuerpaket_versionen" USING btree ("steuerpaket_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "steuerpakete_objekt_jahr_uq" ON "steuerpakete" USING btree ("objekt_id","jahr");--> statement-breakpoint
CREATE INDEX "steuerpakete_objekt_idx" ON "steuerpakete" USING btree ("objekt_id");