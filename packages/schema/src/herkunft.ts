import { z } from 'zod'
import { HerkunftQuelle } from './enums'
import { Uuid } from './gemeinsam'

/** Herkunft eines Feldwerts (docs/PLAN.md 3.3). Pflichtangaben je nach Quelle. */
export const HerkunftEintrag = z
  .object({
    quelle: HerkunftQuelle,
    dokumentId: Uuid.optional(),
    seite: z.number().int().positive().optional(),
    importId: Uuid.optional(),
    zeile: z.number().int().positive().optional(),
    fallId: Uuid.optional(),
    vorschlagId: Uuid.optional(),
    hinweis: z.string().trim().max(500).optional(),
  })
  .superRefine((h, ctx) => {
    const fehlt = (feld: string) =>
      ctx.addIssue({
        code: 'custom',
        path: [feld],
        message: `${feld} ist bei Quelle "${h.quelle}" Pflicht`,
      })
    if (h.quelle === 'dokument' && !h.dokumentId) fehlt('dokumentId')
    if (h.quelle === 'bank_csv' && !h.importId) fehlt('importId')
    if (h.quelle === 'kalkulation' && !h.fallId) fehlt('fallId')
    if (h.quelle === 'ki_vorschlag' && !h.vorschlagId) fehlt('vorschlagId')
  })
export type HerkunftEintrag = z.infer<typeof HerkunftEintrag>

/** Herkunft pro geändertem Feld, Schlüssel = Feldname in camelCase. */
export const Herkunft = z.record(z.string(), HerkunftEintrag)
export type Herkunft = z.infer<typeof Herkunft>
