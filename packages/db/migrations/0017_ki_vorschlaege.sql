CREATE TABLE "ki_vorschlaege" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"aufgabe" text NOT NULL,
	"bezug_entitaet" text NOT NULL,
	"bezug_id" uuid NOT NULL,
	"stempel" jsonb NOT NULL,
	"ausgabe" jsonb NOT NULL,
	"aufruf" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ablauf_am" timestamp with time zone NOT NULL,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ki_vorschlag_entscheidungen" (
	"vorschlag_id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"status" text NOT NULL,
	"grund" text,
	"akteur_art" text NOT NULL,
	"akteur_id" text NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ki_vorschlag_entscheidungen" ADD CONSTRAINT "ki_vorschlag_entscheidungen_vorschlag_id_ki_vorschlaege_id_fk" FOREIGN KEY ("vorschlag_id") REFERENCES "public"."ki_vorschlaege"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ki_vorschlaege_bezug_idx" ON "ki_vorschlaege" USING btree ("bezug_entitaet","bezug_id","erfasst_am");