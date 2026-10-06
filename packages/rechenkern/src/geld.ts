/**
 * Geld-Primitive. Alle Beträge sind ganzzahlige Cent (ADR: Geld als Integer-Cent).
 * Keine Fließkomma-Arithmetik auf Beträgen, nur auf Faktoren mit anschließender Rundung.
 */

/** Ganzzahlige Cent. Branded, damit kein Euro-Float versehentlich hineinläuft. */
export type Cent = number & { readonly __brand: 'Cent' }

export function cent(n: number): Cent {
  if (!Number.isInteger(n)) throw new RangeError(`Cent muss ganzzahlig sein, erhalten: ${n}`)
  if (!Number.isSafeInteger(n)) throw new RangeError(`Cent außerhalb des sicheren Bereichs: ${n}`)
  return n as Cent
}

/** Parst "1.234,56", "1234.56", "1234,5", "-12" zu Cent. Wirft bei Unsinn. */
export function parseEuro(text: string): Cent {
  const t = text.trim().replace(/\s|€/g, '')
  if (t === '') throw new RangeError('leerer Betrag')
  // Deutsches Format: Punkt als Tausender, Komma als Dezimal. Englisches Format: umgekehrt.
  const deutsch = /^-?\d{1,3}(\.\d{3})*(,\d{1,2})?$|^-?\d+(,\d{1,2})?$/.test(t)
  const englisch = /^-?\d{1,3}(,\d{3})*(\.\d{1,2})?$|^-?\d+(\.\d{1,2})?$/.test(t)
  let normalisiert: string
  if (deutsch && !englisch) normalisiert = t.replace(/\./g, '').replace(',', '.')
  else if (englisch && !deutsch) normalisiert = t.replace(/,/g, '')
  else if (deutsch && englisch)
    normalisiert = t // reine Ganzzahl
  else throw new RangeError(`Betrag nicht lesbar: "${text}"`)
  const negativ = normalisiert.startsWith('-')
  const [ganz = '0', bruch = ''] = normalisiert.replace('-', '').split('.')
  const centTeil = (bruch + '00').slice(0, 2)
  const wert = Number(ganz) * 100 + Number(centTeil)
  return cent(negativ ? -wert : wert)
}

/** Formatiert Cent als "1.234,56 €". */
export function formatEuro(betrag: Cent, mitSymbol = true): string {
  const negativ = betrag < 0
  const abs = Math.abs(betrag)
  const euro = Math.floor(abs / 100)
  const rest = abs % 100
  const euroText = euro.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const text = `${negativ ? '-' : ''}${euroText},${rest.toString().padStart(2, '0')}`
  return mitSymbol ? `${text} €` : text
}

/**
 * Kaufmännisches Runden (halb weg von null), wie es Abrechnungen und Finanzamt erwarten.
 * Math.round rundet -0,5 nach 0, das ist hier falsch.
 */
export function rundeKaufmaennisch(wert: number): number {
  if (!Number.isFinite(wert)) throw new RangeError(`nicht rundbar: ${wert}`)
  const sign = wert < 0 ? -1 : 1
  // Epsilon gegen 2.5 → 2.4999999 Artefakte aus vorheriger Division
  return sign * Math.round(Math.abs(wert) + 1e-9)
}

/** Betrag × Faktor, kaufmännisch gerundet. Faktor z. B. 0.19 oder 7/365. */
export function anteil(betrag: Cent, faktor: number): Cent {
  return cent(rundeKaufmaennisch(betrag * faktor))
}

export function summe(betraege: readonly Cent[]): Cent {
  return cent(betraege.reduce<number>((a, b) => a + b, 0))
}

/**
 * Verteilt einen Betrag exakt nach Gewichten (Largest-Remainder-Verfahren).
 * Die Summe der Anteile ist immer gleich dem Gesamtbetrag, auf den Cent.
 * Gewichte sind beliebige nichtnegative Zahlen (Fläche, Personen, Promille, Verbrauch).
 * Bei gleichem Rest gewinnt die frühere Position; der Aufruf ist deterministisch.
 */
export function verteile(gesamt: Cent, gewichte: readonly number[]): Cent[] {
  if (gewichte.length === 0) throw new RangeError('keine Gewichte')
  if (gewichte.some((g) => !Number.isFinite(g) || g < 0)) {
    throw new RangeError('Gewichte müssen endlich und nichtnegativ sein')
  }
  const summeGewichte = gewichte.reduce((a, b) => a + b, 0)
  if (summeGewichte === 0) throw new RangeError('Summe der Gewichte ist 0')

  const sign = gesamt < 0 ? -1 : 1
  const abs = Math.abs(gesamt)

  const roh = gewichte.map((g) => (abs * g) / summeGewichte)
  const basis = roh.map((r) => Math.floor(r))
  let rest = abs - basis.reduce((a, b) => a + b, 0)

  const reihenfolge = roh
    .map((r, i) => ({ i, bruch: r - Math.floor(r) }))
    .sort((a, b) => b.bruch - a.bruch || a.i - b.i)

  for (const { i } of reihenfolge) {
    if (rest <= 0) break
    basis[i] = (basis[i] ?? 0) + 1
    rest -= 1
  }
  return basis.map((b) => cent(sign * b))
}

/** Anzahl Kalendertage im Intervall [von, bis], beide inklusive. ISO-Datumsstrings. */
export function tageInklusive(von: string, bis: string): number {
  const a = Date.UTC(...isoTeile(von))
  const b = Date.UTC(...isoTeile(bis))
  if (b < a) throw new RangeError(`bis (${bis}) liegt vor von (${von})`)
  return Math.round((b - a) / 86_400_000) + 1
}

/** Tage im Jahr (365 oder 366). */
export function tageImJahr(jahr: number): number {
  return (jahr % 4 === 0 && jahr % 100 !== 0) || jahr % 400 === 0 ? 366 : 365
}

function isoTeile(iso: string): [number, number, number] {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) throw new RangeError(`kein ISO-Datum: ${iso}`)
  return [Number(m[1]), Number(m[2]) - 1, Number(m[3])]
}
