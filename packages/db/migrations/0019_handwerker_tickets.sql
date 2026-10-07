CREATE TABLE "handwerker" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "handwerker_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"handwerker_id" uuid NOT NULL,
	"firma" text NOT NULL,
	"ansprechpartner" text,
	"gewerke" text[] NOT NULL,
	"telefon" text,
	"notdienst_telefon" text,
	"email" text,
	"notdienst" boolean DEFAULT false NOT NULL,
	"objekt_ids" uuid[] DEFAULT '{}' NOT NULL,
	"bewertung" smallint,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "notfallkarte_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notfallkarte_id" uuid NOT NULL,
	"eintraege" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notfallkarten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ticket_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ticket_id" uuid NOT NULL,
	"titel" text NOT NULL,
	"beschreibung" text,
	"status" text DEFAULT 'gemeldet' NOT NULL,
	"prioritaet" text DEFAULT 'normal' NOT NULL,
	"auftragnehmer_id" uuid,
	"termin" timestamp with time zone,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "tickets" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL,
	"einheit_id" uuid,
	"mietverhaeltnis_id" uuid,
	"nachricht_id" uuid
);
--> statement-breakpoint
CREATE TABLE "wissensartikel" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wissensartikel_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"wissensartikel_id" uuid NOT NULL,
	"titel" text NOT NULL,
	"kategorie" text NOT NULL,
	"inhalt" text NOT NULL,
	"mieter_sichtbar" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
ALTER TABLE "handwerker_versionen" ADD CONSTRAINT "handwerker_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "handwerker_versionen" ADD CONSTRAINT "handwerker_versionen_handwerker_id_handwerker_id_fk" FOREIGN KEY ("handwerker_id") REFERENCES "public"."handwerker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notfallkarte_versionen" ADD CONSTRAINT "notfallkarte_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notfallkarte_versionen" ADD CONSTRAINT "notfallkarte_versionen_notfallkarte_id_notfallkarten_id_fk" FOREIGN KEY ("notfallkarte_id") REFERENCES "public"."notfallkarten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notfallkarten" ADD CONSTRAINT "notfallkarten_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_versionen" ADD CONSTRAINT "ticket_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_versionen" ADD CONSTRAINT "ticket_versionen_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ticket_versionen" ADD CONSTRAINT "ticket_versionen_auftragnehmer_id_handwerker_id_fk" FOREIGN KEY ("auftragnehmer_id") REFERENCES "public"."handwerker"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_nachricht_id_nachrichten_id_fk" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wissensartikel" ADD CONSTRAINT "wissensartikel_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wissensartikel_versionen" ADD CONSTRAINT "wissensartikel_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wissensartikel_versionen" ADD CONSTRAINT "wissensartikel_versionen_wissensartikel_id_wissensartikel_id_fk" FOREIGN KEY ("wissensartikel_id") REFERENCES "public"."wissensartikel"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "handwerker_versionen_nr_uq" ON "handwerker_versionen" USING btree ("handwerker_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "notfallkarte_versionen_nr_uq" ON "notfallkarte_versionen" USING btree ("notfallkarte_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "notfallkarten_objekt_uq" ON "notfallkarten" USING btree ("objekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ticket_versionen_nr_uq" ON "ticket_versionen" USING btree ("ticket_id","version_nr");--> statement-breakpoint
CREATE INDEX "tickets_objekt_idx" ON "tickets" USING btree ("objekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wissensartikel_versionen_nr_uq" ON "wissensartikel_versionen" USING btree ("wissensartikel_id","version_nr");