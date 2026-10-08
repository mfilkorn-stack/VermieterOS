ALTER TABLE "antworten" ALTER COLUMN "nachricht_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "antworten" ADD COLUMN "portal_nachricht_id" uuid;--> statement-breakpoint
ALTER TABLE "antworten" ADD CONSTRAINT "antworten_portal_nachricht_id_portal_nachrichten_id_fk" FOREIGN KEY ("portal_nachricht_id") REFERENCES "public"."portal_nachrichten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "antworten_portal_idx" ON "antworten" USING btree ("portal_nachricht_id","gesendet_am");