/**
 * Jahresabschluss je Objekt (WP 2.7): Checkliste, ob für ein Jahr alles beisammen ist, was
 * Steuerberater und Mieter brauchen. Im laufenden Jahr derselbe Blick als Vollständigkeits-
 * Wächter: Punkte, die erst nach Jahresende fällig sind, stehen auf „später“.
 */

export type AbschlussDokument = { typ: string; datum: string | null; gueltigBis: string | null }

export type AbschlussEingabe = {
  jahr: number
  heute: string
  weg: boolean
  /** Belege ohne Buchung, am Objekt oder noch ohne Objekt */
  belegeOffen: number
  buchungen: number
  letzteBuchung: string | null
  /** je Einheit mit Mietverhältnis im Jahr */
  bk: ReadonlyArray<{
    einheit: string
    status: 'fehlt' | 'entwurf' | 'festgeschrieben'
    versendet: boolean
  }>
  dokumente: readonly AbschlussDokument[]
  /** Darlehen erkennbar: Kreditvertrag als Dokument oder Schuldzinsen gebucht */
  darlehen: boolean
  steuerpaket: 'offen' | 'entwurf' | 'festgeschrieben'
}

export type AbschlussStand = 'erledigt' | 'offen' | 'spaeter' | 'entfaellt'

export type AbschlussPunkt = {
  code: 'belege' | 'buchungen' | 'grundsteuer' | 'hausgeld' | 'zinsen' | 'bk' | 'steuerpaket'
  titel: string
  stand: AbschlussStand
  text: string
}

export type Abschluss = {
  jahr: number
  laufend: boolean
  punkte: AbschlussPunkt[]
  erledigt: number
  /** Punkte, die jetzt erledigt sein könnten (ohne „später“ und „entfällt“) */
  faellig: number
}

const STILLE_TAGE = 90

function tageZwischen(von: string, bis: string): number {
  return Math.round((Date.parse(bis) - Date.parse(von)) / 86_400_000)
}

const dt = (iso: string) => iso.split('-').reverse().join('.')

/** Gültig im Jahr: ausgestellt bis Jahresende, nicht vor Jahresbeginn abgelaufen. */
function gueltigImJahr(d: AbschlussDokument, jahr: number): boolean {
  return (
    (d.datum == null || d.datum <= `${jahr}-12-31`) &&
    (d.gueltigBis == null || d.gueltigBis >= `${jahr}-01-01`)
  )
}

/** Für das Jahr ausgestellt: datiert ab Dezember des Jahres bis Ende des Folgejahres. */
function fuerJahr(d: AbschlussDokument, jahr: number): boolean {
  return d.datum != null && d.datum >= `${jahr}-12-01` && d.datum <= `${jahr + 1}-12-31`
}

export function jahresabschluss(e: AbschlussEingabe): Abschluss {
  const ende = `${e.jahr}-12-31`
  const laufend = e.heute <= ende
  const nachJahr = (p: Omit<AbschlussPunkt, 'stand'> & { stand: AbschlussStand }) =>
    laufend && p.stand === 'offen' ? { ...p, stand: 'spaeter' as const } : p
  const punkte: AbschlussPunkt[] = []

  punkte.push({
    code: 'belege',
    titel: 'Belege gebucht',
    stand: e.belegeOffen === 0 ? 'erledigt' : 'offen',
    text:
      e.belegeOffen === 0
        ? 'Keine offenen Belege.'
        : `${e.belegeOffen} ${e.belegeOffen === 1 ? 'Beleg ist' : 'Belege sind'} noch nicht gebucht.`,
  })

  const still =
    laufend && e.letzteBuchung != null && tageZwischen(e.letzteBuchung, e.heute) > STILLE_TAGE
  punkte.push({
    code: 'buchungen',
    titel: 'Ausgaben im Journal',
    stand:
      e.buchungen === 0 || still
        ? laufend && e.buchungen === 0
          ? 'spaeter'
          : 'offen'
        : 'erledigt',
    text:
      e.buchungen === 0
        ? `Keine Buchungen ${e.jahr}. Fehlen Hausgeld, Grundsteuer, Versicherung, Zinsen?`
        : still
          ? `Letzte Buchung am ${dt(e.letzteBuchung!)}, seit über ${STILLE_TAGE} Tagen nichts.`
          : `${e.buchungen} ${e.buchungen === 1 ? 'Buchung' : 'Buchungen'}.`,
  })

  const grundsteuer = e.dokumente.some((d) => d.typ === 'grundsteuer' && gueltigImJahr(d, e.jahr))
  punkte.push({
    code: 'grundsteuer',
    titel: 'Grundsteuerbescheid',
    stand: grundsteuer ? 'erledigt' : 'offen',
    text: grundsteuer
      ? `Bescheid für ${e.jahr} liegt vor.`
      : `Kein gültiger Grundsteuerbescheid für ${e.jahr} abgelegt.`,
  })

  if (e.weg) {
    const da = e.dokumente.some((d) => d.typ === 'hausgeldabrechnung' && fuerJahr(d, e.jahr))
    punkte.push(
      nachJahr({
        code: 'hausgeld',
        titel: 'Hausgeldabrechnung der WEG',
        stand: da ? 'erledigt' : 'offen',
        text: da
          ? `Abrechnung ${e.jahr} liegt vor.`
          : laufend
            ? `Kommt nach Jahresende vom Verwalter (Beschluss in der Eigentümerversammlung).`
            : `Hausgeldabrechnung ${e.jahr} fehlt; sie liefert Betriebskosten und Hausgeld nach BFH.`,
      }),
    )
  }

  if (e.darlehen) {
    const da = e.dokumente.some((d) => d.typ === 'zinsbescheinigung' && fuerJahr(d, e.jahr))
    punkte.push(
      nachJahr({
        code: 'zinsen',
        titel: 'Zinsbescheinigung der Bank',
        stand: da ? 'erledigt' : 'offen',
        text: da
          ? `Zinsbescheinigung ${e.jahr} liegt vor.`
          : laufend
            ? 'Kommt nach Jahresende von der Bank.'
            : `Zinsbescheinigung ${e.jahr} fehlt; ohne sie gelten die gebuchten Zinsen.`,
      }),
    )
  }

  if (e.bk.length === 0)
    punkte.push({
      code: 'bk',
      titel: 'Betriebskostenabrechnung',
      stand: 'entfaellt',
      text: `${e.jahr} nicht vermietet.`,
    })
  else {
    const fertig = e.bk.filter((b) => b.status === 'festgeschrieben' && b.versendet)
    const rest = e.bk.filter((b) => !(b.status === 'festgeschrieben' && b.versendet))
    punkte.push(
      nachJahr({
        code: 'bk',
        titel: 'Betriebskostenabrechnung',
        stand: rest.length === 0 ? 'erledigt' : 'offen',
        text:
          rest.length === 0
            ? `Für ${fertig.length === 1 ? 'die Einheit' : `alle ${fertig.length} Einheiten`} festgeschrieben und versendet.`
            : rest
                .map(
                  (b) =>
                    `${b.einheit}: ${b.status === 'fehlt' ? 'nicht angelegt' : b.status === 'entwurf' ? 'Entwurf' : 'nicht versendet'}`,
                )
                .join(', ') + '.',
      }),
    )
  }

  punkte.push(
    nachJahr({
      code: 'steuerpaket',
      titel: 'Steuerpaket',
      stand: e.steuerpaket === 'festgeschrieben' ? 'erledigt' : 'offen',
      text:
        e.steuerpaket === 'festgeschrieben'
          ? 'Festgeschrieben, Paket für den Steuerberater liegt bereit.'
          : laufend
            ? 'Nach Jahresende, wenn die Punkte oben erledigt sind.'
            : e.steuerpaket === 'entwurf'
              ? 'Entwurf, noch nicht festgeschrieben.'
              : 'Noch nicht angelegt.',
    }),
  )

  return {
    jahr: e.jahr,
    laufend,
    punkte,
    erledigt: punkte.filter((p) => p.stand === 'erledigt').length,
    faellig: punkte.filter((p) => p.stand === 'offen').length,
  }
}
