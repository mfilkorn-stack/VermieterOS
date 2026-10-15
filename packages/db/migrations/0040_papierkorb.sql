CREATE TABLE "nachricht_loeschungen" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"nachricht_id" uuid NOT NULL,
	"geloescht" boolean NOT NULL,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "nachricht_loeschungen" ADD CONSTRAINT "nachricht_loeschungen_nachricht_id_nachrichten_id_fk" FOREIGN KEY ("nachricht_id") REFERENCES "public"."nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nachricht_loeschungen_nachricht_idx" ON "nachricht_loeschungen" USING btree ("nachricht_id","erfasst_am");