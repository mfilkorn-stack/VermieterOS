import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

import type { EigentuemerschaftArt } from '@vermieteros/schema'
export type { EigentuemerschaftArt }

/**
 * Der Mandant ist die Eigentümerschaft (ADR 0002). Entspricht 1:1 einer
 * Better-Auth-Organization (`organisation_id`), ergänzt um fachliche Attribute.
 * Kein Ledger-Objekt: Stammsatz, änderbar, aber jede Änderung schreibt ein Ereignis.
 */
export const mandanten = pgTable('mandanten', {
  id: uuid('id').primaryKey(),
  organisationId: text('organisation_id').unique(),
  name: text('name').notNull(),
  art: text('art').$type<EigentuemerschaftArt>().notNull(),
  steuernummer: text('steuernummer'),
  erstelltAm: timestamp('erstellt_am', { withTimezone: true, mode: 'string' })
    .notNull()
    .defaultNow(),
})
