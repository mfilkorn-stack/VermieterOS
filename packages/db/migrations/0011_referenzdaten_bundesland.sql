CREATE TABLE "referenzdaten" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid,
	"art" text NOT NULL,
	"schluessel" text NOT NULL,
	"wert" jsonb NOT NULL,
	"gueltig_von" date NOT NULL,
	"gueltig_bis" date,
	"quelle" text NOT NULL,
	"quelle_url" text,
	"hinweis" text,
	"geprueft_am" date NOT NULL,
	"pruefen_bis" date NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "objekt_versionen" ADD COLUMN "bundesland" text;--> statement-breakpoint
CREATE INDEX "referenzdaten_art_schluessel_idx" ON "referenzdaten" USING btree ("art","schluessel","gueltig_von");