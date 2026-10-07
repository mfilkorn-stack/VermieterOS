CREATE TABLE "journal_anteile" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"eintrag_id" uuid NOT NULL,
	"objekt_id" uuid NOT NULL,
	"einheit_id" uuid,
	"betrag_cent" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_eintraege" (
	"id" uuid PRIMARY KEY NOT NULL,
	"mandant_id" uuid NOT NULL,
	"jahr" integer GENERATED ALWAYS AS ((EXTRACT(YEAR FROM zahlungsdatum))::int) STORED,
	"lfd_nr" integer DEFAULT 0 NOT NULL,
	"belegnummer" text GENERATED ALWAYS AS (((EXTRACT(YEAR FROM zahlungsdatum))::int)::text || '-' || lpad(lfd_nr::text, 4, '0')) STORED,
	"richtung" text NOT NULL,
	"gegenpartei" text NOT NULL,
	"beschreibung" text,
	"rechnungsnummer" text,
	"rechnungsdatum" date,
	"zahlungsdatum" date NOT NULL,
	"leistung_von" date,
	"leistung_bis" date,
	"brutto_cent" bigint NOT NULL,
	"umsatzsteuer_cent" bigint,
	"steuerkategorie" text NOT NULL,
	"verteilung_jahre" integer,
	"kostenart" text,
	"umlagefaehig" boolean DEFAULT false NOT NULL,
	"dokument_id" uuid,
	"ticket_id" uuid,
	"vorschlag_id" uuid,
	"herkunft" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ereignis_id" uuid NOT NULL,
	"erfasst_am" timestamp with time zone DEFAULT now() NOT NULL,
	"erfasst_von" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dokumente" ADD COLUMN "beleg" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "dokumente" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "dokumente" ADD COLUMN "anhang_id" uuid;--> statement-breakpoint
ALTER TABLE "postfaecher" ADD COLUMN "zweck" text DEFAULT 'post' NOT NULL;--> statement-breakpoint
ALTER TABLE "journal_anteile" ADD CONSTRAINT "journal_anteile_eintrag_id_journal_eintraege_id_fk" FOREIGN KEY ("eintrag_id") REFERENCES "public"."journal_eintraege"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_anteile" ADD CONSTRAINT "journal_anteile_objekt_id_objekte_id_fk" FOREIGN KEY ("objekt_id") REFERENCES "public"."objekte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_anteile" ADD CONSTRAINT "journal_anteile_einheit_id_einheiten_id_fk" FOREIGN KEY ("einheit_id") REFERENCES "public"."einheiten"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_eintraege" ADD CONSTRAINT "journal_eintraege_dokument_id_dokumente_id_fk" FOREIGN KEY ("dokument_id") REFERENCES "public"."dokumente"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_eintraege" ADD CONSTRAINT "journal_eintraege_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_eintraege" ADD CONSTRAINT "journal_eintraege_vorschlag_id_ki_vorschlaege_id_fk" FOREIGN KEY ("vorschlag_id") REFERENCES "public"."ki_vorschlaege"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_eintraege" ADD CONSTRAINT "journal_eintraege_ereignis_id_ereignisse_id_fk" FOREIGN KEY ("ereignis_id") REFERENCES "public"."ereignisse"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journal_anteile_eintrag_idx" ON "journal_anteile" USING btree ("eintrag_id");--> statement-breakpoint
CREATE INDEX "journal_anteile_objekt_idx" ON "journal_anteile" USING btree ("objekt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_eintraege_nummer_uq" ON "journal_eintraege" USING btree ("mandant_id","jahr","lfd_nr");--> statement-breakpoint
CREATE INDEX "journal_eintraege_zahlung_idx" ON "journal_eintraege" USING btree ("mandant_id","zahlungsdatum");--> statement-breakpoint
CREATE INDEX "journal_eintraege_dokument_idx" ON "journal_eintraege" USING btree ("dokument_id");--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dokumente" ADD CONSTRAINT "dokumente_anhang_id_anhaenge_id_fk" FOREIGN KEY ("anhang_id") REFERENCES "public"."anhaenge"("id") ON DELETE no action ON UPDATE no action;