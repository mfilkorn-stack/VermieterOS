import type { PersonRolle } from '@vermieteros/schema'
import { date, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { identitaetsSpalten, versionsSpalten } from './versionierung'

/** Personen hängen am Mandanten: Mieter, Miteigentümer, Kontakte. */
export const personen = pgTable('personen', { ...identitaetsSpalten })

export const personVersionen = pgTable(
  'person_versionen',
  {
    ...versionsSpalten,
    personId: uuid('person_id')
      .notNull()
      .references(() => personen.id),
    rolle: text('rolle').$type<PersonRolle>().notNull(),
    anrede: text('anrede'),
    vorname: text('vorname'),
    nachname: text('nachname').notNull(),
    firma: text('firma'),
    strasse: text('strasse'),
    hausnummer: text('hausnummer'),
    plz: text('plz'),
    ort: text('ort'),
    land: text('land').notNull().default('DE'),
    email: text('email'),
    telefon: text('telefon'),
    geburtsdatum: date('geburtsdatum', { mode: 'string' }),
    notizen: text('notizen'),
  },
  (t) => [uniqueIndex('person_versionen_person_nr_uq').on(t.personId, t.versionNr)],
)
