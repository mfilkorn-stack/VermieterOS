import 'server-only'
import { letzteVersion, type Tx } from '@vermieteros/db'
import type { Partei, Wohnung } from '@vermieteros/pdf'
import { sql } from 'drizzle-orm'
import { dezimalText } from './format'
import { aktuelleVertragsdaten } from './vertrag'

function name(p: { vorname?: string | null; nachname: string; firma?: string | null }): string {
  return p.firma || [p.vorname, p.nachname].filter(Boolean).join(' ')
}

/**
 * Daten für Standardschreiben zu einem Mietverhältnis (WP 1.9), aktueller Stand. Vermieter sind
 * die Eigentümer des Mandanten; die Anschrift kommt vom ersten Eigentümer mit Anschrift.
 * Fehlt etwas, bleibt es leer und wird im Formular ergänzt.
 */
export async function schreibDaten(tx: Tx, mietverhaeltnisId: string) {
  const mv = await letzteVersion(tx, 'mietverhaeltnis', mietverhaeltnisId)
  if (!mv) return null
  const [ident] = await tx.execute<{ einheit_id: string }>(
    sql`select einheit_id from mietverhaeltnisse where id = ${mietverhaeltnisId}`,
  )
  const einheitId = ident!.einheit_id
  const einheit = await letzteVersion(tx, 'einheit', einheitId)
  const [eh] = await tx.execute<{ objekt_id: string }>(
    sql`select objekt_id from einheiten where id = ${einheitId}`,
  )
  const objekt = await letzteVersion(tx, 'objekt', eh!.objekt_id)

  const mieter: string[] = []
  for (const pid of mv.mieterIds) {
    const p = await letzteVersion(tx, 'person', pid)
    if (p) mieter.push(name(p))
  }

  const eigentuemer = []
  const ids = await tx.execute<{ person_id: string }>(
    sql`select person_id from eigentumsanteile order by erstellt_am`,
  )
  for (const r of ids) {
    const p = await letzteVersion(tx, 'person', r.person_id)
    if (p) eigentuemer.push(p)
  }
  const mitAnschrift = eigentuemer.find((p) => p.strasse && p.ort)
  const vermieter: Partei = {
    name: eigentuemer.map(name).join(' und '),
    anschrift: mitAnschrift
      ? [
          [mitAnschrift.strasse, mitAnschrift.hausnummer].filter(Boolean).join(' '),
          [mitAnschrift.plz, mitAnschrift.ort].filter(Boolean).join(' '),
        ]
      : [],
  }

  const wohnung: Wohnung = {
    anschrift: [
      [objekt?.strasse, objekt?.hausnummer].filter(Boolean).join(' '),
      [objekt?.plz, objekt?.ort].filter(Boolean).join(' '),
    ].filter(Boolean),
    lage: [einheit?.bezeichnung, einheit?.lage].filter(Boolean).join(', ') || null,
  }

  const { kondition } = await aktuelleVertragsdaten(tx, mietverhaeltnisId)
  return {
    mv,
    mieter,
    vermieter,
    wohnung,
    ort: mitAnschrift?.ort ?? objekt?.ort ?? null,
    wohnflaeche:
      einheit?.wohnflaecheQm100 != null ? dezimalText(einheit.wohnflaecheQm100, 2) : null,
    zimmer:
      einheit?.zimmerX10 != null
        ? einheit.zimmerX10 % 10 === 0
          ? String(einheit.zimmerX10 / 10)
          : dezimalText(einheit.zimmerX10, 1)
        : null,
    kondition,
  }
}

/** „Name\nStraße 1\n12345 Ort“ aus einem Textfeld → Partei. */
export function parteiAusText(text: string): Partei {
  const [name = '', ...anschrift] = text
    .split('\n')
    .map((z) => z.trim())
    .filter(Boolean)
  return { name, anschrift }
}
