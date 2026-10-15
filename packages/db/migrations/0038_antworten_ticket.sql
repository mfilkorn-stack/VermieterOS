ALTER TABLE "antworten" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "antworten" ADD COLUMN "handwerker_id" uuid;--> statement-breakpoint
CREATE INDEX "antworten_ticket_idx" ON "antworten" USING btree ("ticket_id","gesendet_am");