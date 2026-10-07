import type { ZuordnungsKandidat } from '@vermieteros/db'

/**
 * Automatische Zuordnung einer eingehenden Mail zu einem Mietverhältnis (WP 1.1).
 * Reihenfolge, die erste eindeutige Regel gewinnt:
 *   1. Verlauf: Antwort auf eine bereits zugeordnete Nachricht
 *   2. Absender: Adresse gehört zu Mietern genau eines zeitlich passenden Mietverhältnisses
 *   3. Absender und Betreff: mehrere passen, der Betreff nennt genau eine Einheit oder Anschrift
 * Sonst bleibt die Nachricht offen und wird von Hand zugeordnet. Lieber offen als falsch.
 */
export type AutoZuordnung = {
  mietverhaeltnisId: string
  art: 'verlauf' | 'absender' | 'absender_betreff'
}

/** Vor Mietbeginn (Anbahnung) und nach Mietende (Kaution, Abrechnung) gilt ein Mietverhältnis noch als passend. */
const TAGE_VOR_BEGINN = 90
const TAGE_NACH_ENDE = 400

function tage(iso: string, delta: number): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + delta)
  return d.toISOString().slice(0, 10)
}

function nennt(betreff: string, begriff: string | null | undefined): boolean {
  const b = begriff?.trim().toLowerCase()
  if (!b || b.length < 2) return false
  const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'iu').test(betreff)
}

export function bestimmeZuordnung(
  mail: { vonAdresse: string; betreff: string; datum: string; verlauf: string | null },
  kandidaten: readonly ZuordnungsKandidat[],
): AutoZuordnung | null {
  if (mail.verlauf) return { mietverhaeltnisId: mail.verlauf, art: 'verlauf' }

  const von = mail.vonAdresse.toLowerCase()
  const tag = mail.datum.slice(0, 10)
  const passend = kandidaten.filter(
    (k) =>
      k.mieterEmails.includes(von) &&
      tage(k.beginn, -TAGE_VOR_BEGINN) <= tag &&
      (k.ende === null || tag <= tage(k.ende, TAGE_NACH_ENDE)),
  )
  if (passend.length === 1)
    return { mietverhaeltnisId: passend[0]!.mietverhaeltnisId, art: 'absender' }
  if (passend.length === 0) return null

  const treffer = passend.filter(
    (k) =>
      nennt(mail.betreff, k.einheit) ||
      nennt(mail.betreff, [k.strasse, k.hausnummer].filter(Boolean).join(' ')),
  )
  if (treffer.length === 1)
    return { mietverhaeltnisId: treffer[0]!.mietverhaeltnisId, art: 'absender_betreff' }
  return null
}
