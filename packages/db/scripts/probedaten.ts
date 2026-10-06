/**
 * Probedaten für die Betriebsprobe (ops/probe.sh): zwei Mandanten mit Objekt, Einheit,
 * zweiter Version und Storno, also mehreren Ereignissen pro Kette. Läuft mit der App-Rolle.
 * Nur für Wegwerf-Datenbanken; keine echten Daten.
 */
import { v7 as uuidv7 } from 'uuid'
import { createDb } from '../src/client'
import { legeMandantAn, neueVersion, storniereVersion } from '../src/ledger'
import { withMandant } from '../src/mandant'
import type { Akteur } from '../src/schema/index'

const url = process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL fehlt')
const akteur: Akteur = { art: 'nutzer', id: 'betriebsprobe' }
const { db, close } = createDb(url, { max: 1 })

try {
  for (const name of ['Probe A', 'Probe B']) {
    const mandantId = uuidv7()
    await withMandant(db, mandantId, async (tx) => {
      await legeMandantAn(tx, { id: mandantId, name, art: 'allein', akteur })
      const o = await neueVersion(tx, {
        entitaet: 'objekt',
        mandantId,
        akteur,
        gueltigAb: '2024-01-01',
        identitaet: {},
        daten: { bezeichnung: `${name} Haus`, art: 'haus', ort: 'Musterstadt' },
      })
      const e = await neueVersion(tx, {
        entitaet: 'einheit',
        mandantId,
        akteur,
        gueltigAb: '2024-01-01',
        identitaet: { objektId: o.identId },
        daten: { bezeichnung: 'EG', wohnflaecheQm100: 7000 },
      })
      const e2 = await neueVersion(tx, {
        entitaet: 'einheit',
        mandantId,
        akteur,
        gueltigAb: '2025-01-01',
        identId: e.identId,
        begruendung: 'Aufmaß',
        daten: { bezeichnung: 'EG', wohnflaecheQm100: 7150 },
      })
      await storniereVersion(tx, {
        entitaet: 'einheit',
        mandantId,
        versionId: e2.versionId,
        akteur,
        grund: 'Probe',
      })
    })
  }
  console.log('Probedaten angelegt')
} finally {
  await close()
}
