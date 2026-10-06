CREATE TABLE "person_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"person_id" uuid NOT NULL,
	"rolle" text NOT NULL,
	"anrede" text,
	"vorname" text,
	"nachname" text NOT NULL,
	"firma" text,
	"strasse" text,
	"hausnummer" text,
	"plz" text,
	"ort" text,
	"land" text DEFAULT 'DE' NOT NULL,
	"email" text,
	"telefon" text,
	"geburtsdatum" date,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "personen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mietkondition_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mietkondition_id" uuid NOT NULL,
	"kaltmiete_cent" bigint NOT NULL,
	"vorauszahlung_bk_cent" bigint DEFAULT 0 NOT NULL,
	"vorauszahlung_hk_cent" bigint DEFAULT 0 NOT NULL,
	"mietart" text DEFAULT 'vergleich' NOT NULL,
	"staffel" jsonb,
	"personenzahl" integer DEFAULT 1 NOT NULL,
	"grund" text DEFAULT 'vertrag' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mietkonditionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"mietverhaeltnis_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mietverhaeltnis_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"mietverhaeltnis_id" uuid NOT NULL,
	"beginn" date NOT NULL,
	"ende" date,
	"kuendigungsfrist_monate" integer DEFAULT 3 NOT NULL,
	"kaution_cent" bigint,
	"kaution_art" text DEFAULT 'keine' NOT NULL,
	"mieter_ids" uuid[] NOT NULL,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "mietverhaeltnisse" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"einheit_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zaehler" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL,
	"einheit_id" uuid
);
--> statement-breakpoint
CREATE TABLE "zaehler_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"zaehler_id" uuid NOT NULL,
	"art" text NOT NULL,
	"nummer" text NOT NULL,
	"masseinheit" text NOT NULL,
	"eichung_bis" date,
	"eingebaut_am" date,
	"ausgebaut_am" date,
	"bemerkung" text
);
--> statement-breakpoint
CREATE TABLE "zaehlerstaende" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"zaehler_id" uuid NOT NULL,
	"stand_x1000" bigint NOT NULL,
	"abgelesen_am" date NOT NULL,
	"quelle" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"bemerkung" text
);
--> statement-breakpoint
CREATE TABLE "darlehen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "darlehen_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"darlehen_id" uuid NOT NULL,
	"bank" text NOT NULL,
	"kennzeichen" text,
	"nominal_cent" bigint NOT NULL,
	"auszahlung_am" date,
	"zins_bp" integer NOT NULL,
	"tilgung_bp" integer,
	"rate_cent" bigint NOT NULL,
	"zinsbindung_bis" date,
	"sondertilgung_cent_pa" bigint,
	"restschuld_cent" bigint,
	"restschuld_stand" date,
	"bemerkung" text
);
--> statement-breakpoint
CREATE TABLE "dokument_versionen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"version_nr" integer NOT NULL,
	"gueltig_ab" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"begruendung" text,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"dokument_id" uuid NOT NULL,
	"typ" text NOT NULL,
	"status" text DEFAULT 'gueltig' NOT NULL,
	"titel" text NOT NULL,
	"dokumentdatum" date,
	"gueltig_bis" date,
	"ersetzt_durch" uuid,
	"seiten" integer,
	"notizen" text
);
--> statement-breakpoint
CREATE TABLE "dokumente" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"objekt_id" uuid,
	"mietverhaeltnis_id" uuid,
	"datei_hash" text NOT NULL,
	"speicher_schluessel" text NOT NULL,
	"dateiname" text NOT NULL,
	"mime" text NOT NULL,
	"groesse_bytes" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "person_versionen" ADD CONSTRAINT "person_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_versionen" ADD CONSTRAINT "person_versionen_person_id_personen_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietkondition_versionen" ADD CONSTRAINT "mietkondition_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietkondition_versionen" ADD CONSTRAINT "mietkondition_versionen_mietkondition_id_mietkonditionen_id_fk" FOREIGN KEY ("mietkondition_id") REFERENCES "public"."mietkonditionen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietkonditionen" ADD CONSTRAINT "mietkonditionen_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietverhaeltnis_versionen" ADD CONSTRAINT "mietverhaeltnis_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietverhaeltnis_versionen" ADD CONSTRAINT "mietverhaeltnis_versionen_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mietverhaeltnisse" ADD CONSTRAINT "mietverhaeltnisse_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehler" ADD CONSTRAINT "zaehler_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehler" ADD CONSTRAINT "zaehler_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehler_versionen" ADD CONSTRAINT "zaehler_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehler_versionen" ADD CONSTRAINT "zaehler_versionen_zaehler_id_zaehler_id_fk" FOREIGN KEY ("zaehler_id") REFERENCES "public"."zaehler"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehlerstaende" ADD CONSTRAINT "zaehlerstaende_zaehler_id_zaehler_id_fk" FOREIGN KEY ("zaehler_id") REFERENCES "public"."zaehler"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zaehlerstaende" ADD CONSTRAINT "zaehlerstaende_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darlehen" ADD CONSTRAINT "darlehen_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darlehen_versionen" ADD CONSTRAINT "darlehen_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "darlehen_versionen" ADD CONSTRAINT "darlehen_versionen_darlehen_id_darlehen_id_fk" FOREIGN KEY ("darlehen_id") REFERENCES "public"."darlehen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_versionen" ADD CONSTRAINT "dokument_versionen_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokument_versionen" ADD CONSTRAINT "dokument_versionen_dokument_id_dokumente_id_fk" FOREIGN KEY ("dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "person_versionen_person_nr_uq" ON "person_versionen" USING btree ("person_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "mietkondition_versionen_mk_nr_uq" ON "mietkondition_versionen" USING btree ("mietkondition_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "mietverhaeltnis_versionen_mv_nr_uq" ON "mietverhaeltnis_versionen" USING btree ("mietverhaeltnis_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "zaehler_versionen_zaehler_nr_uq" ON "zaehler_versionen" USING btree ("zaehler_id","version_nr");--> statement-breakpoint
CREATE INDEX "zaehlerstaende_zaehler_datum_idx" ON "zaehlerstaende" USING btree ("zaehler_id","abgelesen_am");--> statement-breakpoint
CREATE UNIQUE INDEX "darlehen_versionen_darlehen_nr_uq" ON "darlehen_versionen" USING btree ("darlehen_id","version_nr");--> statement-breakpoint
CREATE UNIQUE INDEX "dokument_versionen_dokument_nr_uq" ON "dokument_versionen" USING btree ("dokument_id","version_nr");