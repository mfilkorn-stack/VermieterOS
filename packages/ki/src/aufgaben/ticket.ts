import { z } from 'zod'
import type { Aufgabe } from '../aufgabe'
import type { DokumentKontextDaten } from '../kontext/dokument'
import { KATEGORIEN } from './sortierung'

export const TicketAuszug = z.object({
  titel: z
    .string()
    .describe('Kurz, sachlich, höchstens 120 Zeichen, z. B. "Heizung im Bad bleibt kalt"'),
  beschreibung: z
    .string()
    .describe('Was, wo, seit wann, was schon versucht wurde; nur Inhalte aus dem Dokument'),
  prioritaet: z
    .enum(['normal', 'hoch', 'notfall'])
    .describe(
      'notfall: Gefahr oder Ausfall von Heizung, Wasser, Strom; hoch: zeitnah; sonst normal',
    ),
  kategorie: z.enum(KATEGORIEN),
  /** Hinweise an den Vermieter: Unleserliches, fehlende Angaben, mehrere Mängel in einer Meldung */
  hinweise: z.array(z.string()),
})
export type TicketAuszug = z.infer<typeof TicketAuszug>

/**
 * Liest eine Mängelmeldung oder ein Schreiben (PDF oder Foto) und schlägt Titel, Beschreibung
 * und Priorität für ein Ticket vor (UX-8). Namen von Mietern werden nicht wiederholt, die
 * Zuordnung zu Objekt und Einheit trifft der Mensch im Formular.
 */
export const TICKET_EXTRAKTION: Aufgabe<DokumentKontextDaten, TicketAuszug> = {
  name: 'ticket_extraktion',
  version: 1,
  maxTokens: 2_000,
  aufwand: 'medium',
  ablaufTage: 14,
  goldenSchwelle: 0.95,
  system: [
    'Du liest Mängelmeldungen, Schadensmeldungen und Schreiben an private Vermieter (PDF, Scan oder Foto) und fasst sie als Ticket zusammen.',
    'titel: ein kurzer sachlicher Satz, was kaputt ist oder verlangt wird. Kein Name, keine Anrede.',
    'beschreibung: die wesentlichen Angaben in eigenen Worten, nur was im Dokument steht: Ort im Objekt, seit wann, Auswirkung, Wünsche (Termin, Rückruf). Nichts erfinden, nichts bewerten.',
    'prioritaet: notfall bei Gefahr oder Ausfall von Heizung, Wasser, Strom, Gas oder bei Wasserschaden; hoch, wenn eine Frist oder Dringlichkeit genannt ist; sonst normal.',
    'kategorie: die passendste aus der vorgegebenen Liste.',
    'hinweise: was der Vermieter zusätzlich wissen sollte, z. B. unleserliche Stellen, mehrere Mängel in einer Meldung, fehlende Kontaktdaten. Leer, wenn nichts auffällt.',
    'Personennamen aus dem Dokument nicht in titel oder beschreibung übernehmen.',
  ].join('\n'),
  nachricht: (d) =>
    JSON.stringify(
      {
        dokument: { titel: d.titel, dateiname: d.dateiname, seiten: d.seiten.length || null },
        mietverhaeltnis: d.mietverhaeltnis,
      },
      null,
      2,
    ),
  dateien: (d) => [{ mime: d.mime, daten: d.datei }],
  ausgabe: TicketAuszug,
  pruefe: (a) => {
    const befunde: string[] = []
    if (!a.titel.trim()) befunde.push('Titel fehlt')
    if (a.titel.length > 200) befunde.push('Titel länger als 200 Zeichen')
    if (a.beschreibung.length > 4000) befunde.push('Beschreibung länger als 4000 Zeichen')
    return befunde
  },
}
