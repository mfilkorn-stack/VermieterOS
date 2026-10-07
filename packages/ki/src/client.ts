import Anthropic from '@anthropic-ai/sdk'
import type { BetaContentBlockParam } from '@anthropic-ai/sdk/resources/beta/messages/messages'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import type { z } from 'zod'

/** Standardmodell (PLAN 4.4). Ein günstigeres nur, wenn es das Golden-Set gleich gut besteht. */
export const STANDARD_MODELL = 'claude-opus-5-5'

export type KiAufwand = 'low' | 'medium' | 'high'

/** Datei für das Modell, z. B. ein Vertrag als PDF (Dokumentblock) oder ein Foto (Bildblock). */
export type KiDatei = { mime: string; daten: Uint8Array }

export type KiAnfrage<T> = {
  modell: string
  /** Stabiler Teil (Rolle, Regeln, Vorlagen); wird gecacht. */
  system: string
  /** Veränderlicher Teil: der Kontext dieses Aufrufs. */
  nachricht: string
  /** Dateien vor dem Text der Nachricht */
  dateien?: KiDatei[]
  schema: z.ZodType<T>
  maxTokens: number
  /** Denktiefe; Standard des Modells, wenn leer */
  aufwand?: KiAufwand
}

export type KiNutzung = {
  eingabe: number
  ausgabe: number
  cacheGelesen: number
  cacheGeschrieben: number
}

export type KiAntwort<T> = {
  ausgabe: T
  /** Modell laut Antwort, nicht laut Anfrage */
  modell: string
  anfrageId: string | null
  nutzung: KiNutzung
}

/** Schnittstelle zum Modell. In Tests ersetzt durch `FakeKiClient`. */
export interface KiClient {
  erzeuge<T>(a: KiAnfrage<T>): Promise<KiAntwort<T>>
}

export class KiFehler extends Error {
  constructor(
    message: string,
    readonly art: 'nicht_konfiguriert' | 'verweigert' | 'abgeschnitten' | 'ungueltig' | 'abgelehnt',
  ) {
    super(message)
    this.name = 'KiFehler'
  }
}

/** Anbindung über das offizielle SDK: strukturierte Ausgabe per Zod, adaptives Denken, Prompt-Caching. */
export function anthropicClient(o: { apiKey: string; basisUrl?: string | undefined }): KiClient {
  const c = new Anthropic({
    apiKey: o.apiKey,
    ...(o.basisUrl ? { baseURL: o.basisUrl } : {}),
    maxRetries: 2,
    timeout: 120_000,
  })
  return {
    async erzeuge<T>(a: KiAnfrage<T>): Promise<KiAntwort<T>> {
      const inhalt: BetaContentBlockParam[] = [
        ...(a.dateien ?? []).map(dateiBlock),
        { type: 'text', text: a.nachricht },
      ]
      // create statt parse: Ablehnung und Abbruch erst erkennen, dann selbst parsen und prüfen.
      // Bei einer Ablehnung durch die Sicherheitsfilter übernimmt serverseitig ein anderes Modell.
      const { data: m, request_id } = await c.beta.messages
        .create({
          model: a.modell,
          max_tokens: a.maxTokens,
          thinking: { type: 'adaptive', display: 'omitted' },
          system: [{ type: 'text', text: a.system, cache_control: { type: 'ephemeral' } }],
          messages: [{ role: 'user', content: inhalt }],
          output_config: {
            format: zodOutputFormat(a.schema as z.ZodType),
            ...(a.aufwand ? { effort: a.aufwand } : {}),
          },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        })
        .withResponse()
      if (m.stop_reason === 'refusal') throw new KiFehler('Das Modell hat abgelehnt.', 'verweigert')
      if (m.stop_reason === 'max_tokens') {
        throw new KiFehler('Antwort abgeschnitten (max_tokens).', 'abgeschnitten')
      }
      const text = m.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
      let json: unknown
      try {
        json = JSON.parse(text)
      } catch {
        throw new KiFehler('Keine gültige JSON-Ausgabe.', 'ungueltig')
      }
      const geprueft = a.schema.safeParse(json)
      if (!geprueft.success) {
        throw new KiFehler(`Ausgabe passt nicht zum Schema: ${geprueft.error.message}`, 'ungueltig')
      }
      return {
        ausgabe: geprueft.data,
        modell: m.model,
        anfrageId: request_id ?? null,
        nutzung: {
          eingabe: m.usage.input_tokens,
          ausgabe: m.usage.output_tokens,
          cacheGelesen: m.usage.cache_read_input_tokens ?? 0,
          cacheGeschrieben: m.usage.cache_creation_input_tokens ?? 0,
        },
      }
    },
  }
}

function dateiBlock(d: KiDatei): BetaContentBlockParam {
  const data = Buffer.from(d.daten).toString('base64')
  if (d.mime === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data } }
  }
  if (
    d.mime === 'image/jpeg' ||
    d.mime === 'image/png' ||
    d.mime === 'image/webp' ||
    d.mime === 'image/gif'
  ) {
    return { type: 'image', source: { type: 'base64', media_type: d.mime, data } }
  }
  throw new KiFehler(`Dateityp ${d.mime} kann die KI nicht lesen.`, 'ungueltig')
}

/** Client aus der Umgebung (`ANTHROPIC_API_KEY`). Ohne Schlüssel ist die KI aus, nicht kaputt. */
export function kiClientAusUmgebung(env: NodeJS.ProcessEnv = process.env): KiClient | null {
  const apiKey = env['ANTHROPIC_API_KEY']?.trim()
  if (!apiKey) return null
  return anthropicClient({ apiKey, basisUrl: env['ANTHROPIC_BASE_URL'] || undefined })
}

/** Modell aus der Umgebung (`KI_MODELL`), sonst das Standardmodell. */
export function kiModell(env: NodeJS.ProcessEnv = process.env): string {
  return env['KI_MODELL']?.trim() || STANDARD_MODELL
}
