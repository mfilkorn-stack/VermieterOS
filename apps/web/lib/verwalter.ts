import { Email, VERWALTUNG_ARTEN, type Verwalter, type VerwaltungArt } from '@vermieteros/schema'
import { Eingabefehler, text } from './eingabe'

export const VERWALTUNG_TEXT: Record<VerwaltungArt, string> = {
  weg: 'WEG-Verwaltung',
  miet: 'Mietverwaltung',
}

/** Verwalter aus dem Stammdaten-Formular; ein Block ohne jede Angabe entfällt, ganz leer: null. */
export function verwalterAusFormular(d: FormData): Verwalter[] | null {
  const liste: Verwalter[] = []
  for (const art of VERWALTUNG_ARTEN) {
    const v = {
      art,
      firma: text(d, art + '_firma'),
      ansprechpartner: text(d, art + '_ansprechpartner'),
      telefon: text(d, art + '_telefon'),
      email: text(d, art + '_email'),
      notiz: text(d, art + '_notiz'),
    }
    const irgendwas = v.firma || v.ansprechpartner || v.telefon || v.email || v.notiz
    if (!irgendwas) continue
    if (!v.firma) throw new Eingabefehler(VERWALTUNG_TEXT[art] + ': Bitte die Firma angeben.')
    if (v.email && !Email.safeParse(v.email).success)
      throw new Eingabefehler(VERWALTUNG_TEXT[art] + ': Die E-Mail-Adresse ist ungültig.')
    liste.push({ ...v, firma: v.firma })
  }
  return liste.length ? liste : null
}
