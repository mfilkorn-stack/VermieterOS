CREATE TABLE "ereignisse" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"seq" bigint DEFAULT 0 NOT NULL,
	"typ" text NOT NULL,
	"entitaet" text,
	"entitaet_id" uuid,
	"version_id" uuid,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"prev_hash" text DEFAULT '' NOT NULL,
	"hash" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stornos" (
	"version_id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"entitaet" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"grund" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mandanten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"organisation_id" text,
	"name" text NOT NULL,
	"art" text NOT NULL,
	"steuernummer" text,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mandanten_organisation_id_unique" UNIQUE("organisation_id")
);
--> statement-breakpoint
CREATE TABLE "objekt_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objekt_id" uuid NOT NULL,
	"bezeichnung" text NOT NULL,
	"strasse" text,
	"hausnummer" text,
	"plz" text,
	"ort" text,
	"art" text NOT NULL,
	"baujahr" integer,
	"weg" boolean DEFAULT false NOT NULL,
	"anschaffungsdatum" date,
	"kaufpreis_cent" bigint,
	"anschaffungsnebenkosten_cent" bigint,
	"gebaeudeanteil_promille" integer,
	"afa_satz_promille" integer,
	"afa_beginn" date
);
--> statement-breakpoint
CREATE TABLE "objekte" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "einheit_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"einheit_id" uuid NOT NULL,
	"bezeichnung" text NOT NULL,
	"lage" text,
	"typ" text DEFAULT 'wohnung' NOT NULL,
	"wohnflaeche_qm100" integer,
	"zimmer_x10" integer,
	"miteigentumsanteil_zaehler" integer,
	"miteigentumsanteil_nenner" integer
);
--> statement-breakpoint
CREATE TABLE "einheiten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stornos" ADD CONSTRAINT "stornos_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objekt_versionen" ADD CONSTRAINT "objekt_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "objekt_versionen" ADD CONSTRAINT "objekt_versionen_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einheit_versionen" ADD CONSTRAINT "einheit_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einheit_versionen" ADD CONSTRAINT "einheit_versionen_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "einheiten" ADD CONSTRAINT "einheiten_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ereignisse_mandant_seq_uq" ON "ereignisse" USING btree ("mandant_id","seq");--> statement-breakpoint
CREATE UNIQUE INDEX "objekt_versionen_objekt_nr_uq" ON "objekt_versionen" USING btree ("objekt_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "einheit_versionen_einheit_nr_uq" ON "einheit_versionen" USING btree ("einheit_id","version_nr");