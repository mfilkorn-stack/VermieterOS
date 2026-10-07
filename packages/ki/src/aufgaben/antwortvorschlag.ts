import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { NachrichtDaten } from '../kontext/nachricht'

export const Antwortvorschlag = z.object({
  entwurf: z.string().describe('Antworttext mit Platzhaltern, ohne Ziffern'),
  zusagen: z
    .array(z.string())
    .describe('Jede Stelle im Entwurf, die etwas zusagt, anerkennt oder ablehnt; leer, wenn keine'),
  offene_punkte: z
    .array(z.string())
    .describe('Was der Vermieter vor dem Senden entscheiden oder ergänzen muss'),
})
export type Antwortvorschlag = z.infer<typeof Antwortvorschlag>

/**
 * Wörter, die auf eine Zusage, Anerkennung oder rechtliche Aussage hindeuten.
 * Steht eines davon im Entwurf, muss die KI die Stelle unter `zusagen` markiert haben.
 */
const ZUSAGE_SIGNALE = [
  'übernehmen',
  'übernimmt',
  'erstatten',
  'erstattung',
  'anspruch',
  'minderung',
  'mindern',
  'verzicht',
  'garantier',
  'zusagen',
  'sichern ihnen zu',
  'kündig',
  'schadensersatz',
  'kosten trägt',
  'kostenlos',
  'auf unsere kosten',
]

/**
 * Antwortentwurf zu einer Mail (WP 1.5). Fakten nur als Platzhalter (ADR 0005);
 * Zusagen werden markiert, damit der Vermieter sie vor dem Senden bewusst prüft.
 */
export const ANTWORTVORSCHLAG: Aufgabe<NachrichtDaten, Antwortvorschlag> = {
  name: 'antwortvorschlag',
  version: 1,
  maxTokens: 8_000,
  system: [
    'Du entwirfst Antworten privater Vermieter auf E-Mails ihrer Mieter, Handwerker und Behörden.',
    'Du erhältst die eingegangene E-Mail als JSON und eine Liste erlaubter Platzhalter mit Beschreibung.',
    '',
    'Regeln für den Entwurf:',
    '- Deutsch, höflich, sachlich, kurz. Anrede und Grußformel; Sie-Form, außer die Mail duzt.',
    '- Fakten stehen NIE als Wert im Text, sondern als Platzhalter in doppelten geschweiften Klammern, z. B. {{mieter.name}}. Verwende nur Platzhalter aus der Liste.',
    '- Der Entwurf enthält keine Ziffern: keine Beträge, Daten, Uhrzeiten, Telefonnummern, Hausnummern, Fristen in Tagen. Wenn eine solche Angabe nötig ist, schreibe [bitte ergänzen: Beschreibung] und nimm den Punkt in offene_punkte auf.',
    '- Sage nichts zu, was der Vermieter nicht ausdrücklich entschieden hat: keine Kostenübernahme, keine Mietminderung, keine Termine, keine Anerkennung von Ansprüchen, keine rechtliche Einschätzung. Bestätige den Eingang, kündige Prüfung oder Rückmeldung an.',
    '- Jede Stelle, die dennoch etwas zusagt, anerkennt oder ablehnt, nennst du wörtlich unter zusagen. Gibt es keine, ist zusagen leer.',
    '- Unterschreibe mit {{vermieter.name}}.',
    '',
    'offene_punkte: was der Vermieter vor dem Senden entscheiden oder ergänzen muss, je ein kurzer Satz.',
  ].join('\n'),
  nachricht: (d, p) => JSON.stringify({ mail: d, erlaubte_platzhalter: p }, null, 2),
  ausgabe: Antwortvorschlag,
  entwuerfe: (a) => [a.entwurf],
  pruefe: (a) => {
    const text = a.entwurf.toLowerCase()
    const signal = ZUSAGE_SIGNALE.find((s) => text.includes(s))
    return signal && a.zusagen.length === 0
      ? [`Entwurf enthält „${signal}“, aber keine markierte Zusage`]
      : []
  },
}
