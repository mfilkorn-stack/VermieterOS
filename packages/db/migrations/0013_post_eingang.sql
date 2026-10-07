CREATE TABLE "anhaenge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"nachricht_id" uuid NOT NULL,
	"dateiname" text NOT NULL,
	"mime_typ" text NOT NULL,
	"groesse" integer NOT NULL,
	"sha256" text NOT NULL,
	"schluessel" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nachricht_zuordnungen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"nachricht_id" uuid NOT NULL,
	"mietverhaeltnis_id" uuid,
	"art" text NOT NULL,
	"begruendung" text,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nachrichten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"postfach_id" uuid NOT NULL,
	"uid_validity" bigint,
	"imap_uid" bigint,
	"message_id" text,
	"in_reply_to" text,
	"referenzen" text[] DEFAULT '{}' NOT NULL,
	"von_adresse" text NOT NULL,
	"von_name" text,
	"an" text[] DEFAULT '{}' NOT NULL,
	"betreff" text DEFAULT '' NOT NULL,
	"gesendet_am" timestamp with time zone,
	"empfangen_am" timestamp with time zone DEFAULT now() NOT NULL,
	"text" text DEFAULT '' NOT NULL,
	"roh_schluessel" text NOT NULL,
	"roh_sha256" text NOT NULL,
	"roh_groesse" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "postfaecher" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"bezeichnung" text NOT NULL,
	"host" text NOT NULL,
	"port" integer DEFAULT 993 NOT NULL,
	"tls" boolean DEFAULT true NOT NULL,
	"benutzer" text NOT NULL,
	"passwort_chiffre" text NOT NULL,
	"ordner" text DEFAULT 'INBOX' NOT NULL,
	"abruf_ab" date NOT NULL,
	"aktiv" boolean DEFAULT true NOT NULL,
	"uid_validity" bigint,
	"letzte_uid" bigint DEFAULT 0 NOT NULL,
	"letzter_abruf" timestamp with time zone,
	"letzter_fehler" text,
	"angelegt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "anhaenge" ADD CONSTRAINT "anhaenge_nachricht_id_nachrichten_id_fk" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nachricht_zuordnungen" ADD CONSTRAINT "nachricht_zuordnungen_nachricht_id_nachrichten_id_fk" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nachrichten" ADD CONSTRAINT "nachrichten_postfach_id_postfaecher_id_fk" FOREIGN KEY ("postfach_id") REFERENCES "public"."postfaecher"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nachricht_zuordnungen_nachricht_idx" ON "nachricht_zuordnungen" USING btree ("nachricht_id","erfasst_am");--> statement-breakpoint
CREATE UNIQUE INDEX "nachrichten_postfach_roh_uq" ON "nachrichten" USING btree ("postfach_id","roh_sha256");--> statement-breakpoint
CREATE INDEX "nachrichten_mandant_message_id_idx" ON "nachrichten" USING btree ("mandant_id","message_id");--> statement-breakpoint
CREATE INDEX "nachrichten_mandant_empfangen_idx" ON "nachrichten" USING btree ("mandant_id","empfangen_am");