CREATE TABLE "antworten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"nachricht_id" uuid NOT NULL,
	"mietverhaeltnis_id" uuid,
	"an" text[] NOT NULL,
	"betreff" text NOT NULL,
	"text" text NOT NULL,
	"message_id" text NOT NULL,
	"gesendet_am" timestamp with time zone DEFAULT now() NOT NULL,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "antworten" ADD CONSTRAINT "antworten_nachricht_id_nachrichten_id_fk" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "antworten_nachricht_idx" ON "antworten" USING btree ("nachricht_id","gesendet_am");--> statement-breakpoint
CREATE INDEX "antworten_mv_gesendet_idx" ON "antworten" USING btree ("mietverhaeltnis_id","gesendet_am");