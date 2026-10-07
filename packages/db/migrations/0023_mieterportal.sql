CREATE TABLE "portal_nachrichten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"mietverhaeltnis_id" uuid NOT NULL,
	"zugang_id" uuid NOT NULL,
	"betreff" text NOT NULL,
	"text" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portal_sitzungen" (
	"hash" text PRIMARY KEY NOT NULL,
	"zugang_id" uuid NOT NULL,
	"ablauf_am" timestamp with time zone NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"beendet_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_tokens" (
	"hash" text PRIMARY KEY NOT NULL,
	"zugang_id" uuid NOT NULL,
	"ablauf_am" timestamp with time zone NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"verwendet_am" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "portal_zugaenge" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"mietverhaeltnis_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"email" text NOT NULL,
	"erstellt_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erstellt_von" text NOT NULL,
	"widerrufen_am" timestamp with time zone,
	"widerrufen_von" text
);
--> statement-breakpoint
ALTER TABLE "portal_nachrichten" ADD CONSTRAINT "portal_nachrichten_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_nachrichten" ADD CONSTRAINT "portal_nachrichten_zugang_id_portal_zugaenge_id_fk" FOREIGN KEY ("zugang_id") REFERENCES "public"."portal_zugaenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_sitzungen" ADD CONSTRAINT "portal_sitzungen_zugang_id_portal_zugaenge_id_fk" FOREIGN KEY ("zugang_id") REFERENCES "public"."portal_zugaenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_tokens" ADD CONSTRAINT "portal_tokens_zugang_id_portal_zugaenge_id_fk" FOREIGN KEY ("zugang_id") REFERENCES "public"."portal_zugaenge"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_zugaenge" ADD CONSTRAINT "portal_zugaenge_mietverhaeltnis_id_mietverhaeltnisse_id_fk" FOREIGN KEY ("mietverhaeltnis_id") REFERENCES "public"."mietverhaeltnisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portal_zugaenge" ADD CONSTRAINT "portal_zugaenge_person_id_personen_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."personen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "portal_nachrichten_mv_idx" ON "portal_nachrichten" USING btree ("mietverhaeltnis_id","erstellt_am");--> statement-breakpoint
CREATE UNIQUE INDEX "portal_zugaenge_aktiv_uq" ON "portal_zugaenge" USING btree ("mietverhaeltnis_id","email") WHERE widerrufen_am IS NULL;--> statement-breakpoint
CREATE INDEX "portal_zugaenge_email_idx" ON "portal_zugaenge" USING btree ("email");