ALTER TABLE "objekt_versionen" ADD COLUMN "grundbuch" jsonb;--> statement-breakpoint
ALTER TABLE "objekt_versionen" ADD COLUMN "kaufvertrag_datum" date;--> statement-breakpoint
ALTER TABLE "objekt_versionen" ADD COLUMN "anschaffungsnebenkosten" jsonb;