CREATE TABLE "telefonnotizen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"mietverhaeltnis_id" uuid NOT NULL,
	"zeitpunkt" timestamp with time zone NOT NULL,
	"richtung" text NOT NULL,
	"gespraechspartner" text NOT NULL,
	"betreff" text NOT NULL,
	"inhalt" text NOT NULL,
	"ersetzt_id" uuid,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "telefonnotizen" ADD CONSTRAINT "telefonnotizen_ersetzt_id_telefonnotizen_id_fk" FOREIGN KEY ("ersetzt_id") REFERENCES "public"."telefonnotizen"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "telefonnotizen_mv_zeitpunkt_idx" ON "telefonnotizen" USING btree ("mietverhaeltnis_id","zeitpunkt");--> statement-breakpoint
CREATE UNIQUE INDEX "telefonnotizen_ersetzt_uq" ON "telefonnotizen" USING btree ("ersetzt_id");