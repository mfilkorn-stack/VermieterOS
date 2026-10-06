'use server'

import { EigentumsanteilDaten, PersonDaten } from '@vermieteros/schema'
import { redirect } from 'next/navigation'
import { bruch, datum, Eingabefehler, pflicht, text, zodText } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'
import { speichere } from '@/lib/speichern'

function anteilAus(d: FormData) {
  const b = bruch(text(d, 'zaehler'), text(d, 'nenner'), 'Anteil')
  if (!b) throw new Eingabefehler('Anteil fehlt (z. B. 1 / 2).')
  const r = EigentumsanteilDaten.safeParse(b)
  if (!r.success) throw new Eingabefehler(zodText(r.error))
  return r.data
}

export async function eigentuemerAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const giltAb = datum(d, 'giltAb', 'Gilt ab')
    if (!giltAb) throw new Eingabefehler('Gilt ab fehlt.')
    const person = PersonDaten.safeParse({
      rolle: 'miteigentuemer',
      vorname: text(d, 'vorname'),
      nachname: pflicht(d, 'nachname', 'Nachname'),
    })
    if (!person.success) throw new Eingabefehler(zodText(person.error))
    const anteil = anteilAus(d)
    await mitMandant(async (tx, k) => {
      const p = await speichere(tx, k, {
        entitaet: 'person',
        identitaet: {},
        daten: person.data,
        gueltigAb: giltAb,
      })
      await speichere(tx, k, {
        entitaet: 'eigentumsanteil',
        identitaet: { personId: p.identId },
        daten: anteil,
        gueltigAb: giltAb,
      })
    })
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/eigentuemer')
}

export async function anteilAendern(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ stammdaten: ['schreiben'] })
    const anteil = anteilAus(d)
    await mitMandant((tx, k) =>
      speichere(tx, k, {
        entitaet: 'eigentumsanteil',
        identId: pflicht(d, 'anteilId', 'Anteil'),
        daten: anteil,
        gueltigAb: datum(d, 'giltAb', 'Gilt ab'),
        begruendung: text(d, 'begruendung'),
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/eigentuemer')
}
