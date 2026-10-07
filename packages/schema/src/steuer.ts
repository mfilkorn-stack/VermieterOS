import { z } from 'zod'
import { CentNichtNegativ, Notiz, Uuid } from './gemeinsam'

/**
 * Steuerpaket eines Objekts für ein Jahr (WP 2.6, ADR 0013): Korrekturen zur automatischen
 * Rechnung (Mietausfall, Hausgeld nach WEG-Abrechnung, Zinsen laut Bescheinigung, weitere
 * Werbungskosten) und die Festschreibung mit dem Paket für den Steuerberater.
 */
export const SteuerpaketDaten = z.object({
  mietausfallCent: CentNichtNegativ.nullish(),
  hausgeld: z
    .object({
      gezahltCent: CentNichtNegativ,
      zufuehrungCent: CentNichtNegativ,
      entnahmeCent: CentNichtNegativ,
    })
    .nullish(),
  schuldzinsenCent: CentNichtNegativ.nullish(),
  weitere: z
    .array(
      z.object({ bezeichnung: z.string().trim().min(1).max(120), betragCent: CentNichtNegativ }),
    )
    .max(30)
    .nullish(),
  notizen: Notiz.nullish(),
  status: z.enum(['entwurf', 'festgeschrieben']).default('entwurf'),
  /** bei Festschreibung: Überschuss und das ZIP-Paket als Dokument */
  ueberschussCent: z.number().int().safe().nullish(),
  paketDokumentId: Uuid.nullish(),
})
export type SteuerpaketDaten = z.infer<typeof SteuerpaketDaten>
export const SteuerpaketIdentitaet = z.object({ objektId: Uuid, jahr: z.number().int() })
