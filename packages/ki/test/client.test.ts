import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'
import {
  anthropicClient,
  KiFehler,
  kiClientAusUmgebung,
  kiModell,
  STANDARD_MODELL,
} from '../src/client'

/** Nachgebauter Messages-Endpunkt: prüft, was das SDK sendet, ohne Netz und ohne Schlüssel. */
let server: Server
let basisUrl: string
let letzte: Record<string, unknown> = {}
let antwort: { stop_reason: string; text: string } = { stop_reason: 'end_turn', text: '{}' }

beforeAll(async () => {
  server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      letzte = { pfad: req.url, beta: req.headers['anthropic-beta'], ...JSON.parse(body) }
      res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_test_1' })
      res.end(
        JSON.stringify({
          id: 'msg_1',
          type: 'message',
          role: 'assistant',
          model: 'claude-opus-5-5',
          content: [{ type: 'text', text: antwort.text }],
          stop_reason: antwort.stop_reason,
          stop_sequence: null,
          usage: {
            input_tokens: 120,
            output_tokens: 30,
            cache_read_input_tokens: 100,
            cache_creation_input_tokens: 0,
          },
        }),
      )
    })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  basisUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => new Promise<void>((r) => server.close(() => r())))

const Schema = z.object({ kategorie: z.enum(['heizung', 'sonstiges']), dringend: z.boolean() })

describe('Anthropic-Client', () => {
  it('sendet Modell, adaptives Denken, gecachten Systemteil und Schema; liefert geprüfte Ausgabe', async () => {
    antwort = { stop_reason: 'end_turn', text: '{"kategorie":"heizung","dringend":true}' }
    const c = anthropicClient({ apiKey: 'test', basisUrl })
    const r = await c.erzeuge({
      modell: STANDARD_MODELL,
      system: 'Regeln',
      nachricht: 'Mail: Heizung kalt',
      dateien: [{ mime: 'application/pdf', daten: new TextEncoder().encode('%PDF-1.4') }],
      schema: Schema,
      maxTokens: 1000,
      aufwand: 'low',
    })
    expect(r.ausgabe).toEqual({ kategorie: 'heizung', dringend: true })
    expect(r.anfrageId).toBe('req_test_1')
    expect(r.nutzung).toEqual({ eingabe: 120, ausgabe: 30, cacheGelesen: 100, cacheGeschrieben: 0 })
    expect(letzte).toMatchObject({
      pfad: '/v1/messages?beta=true',
      beta: 'server-side-fallback-2026-07-01',
      fallbacks: 'default',
      model: 'claude-opus-5-5',
      max_tokens: 1000,
      thinking: { type: 'adaptive' },
      system: [{ type: 'text', text: 'Regeln', cache_control: { type: 'ephemeral' } }],
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: 'application/pdf', data: 'JVBERi0xLjQ=' },
            },
            { type: 'text', text: 'Mail: Heizung kalt' },
          ],
        },
      ],
      output_config: { format: { type: 'json_schema' }, effort: 'low' },
    })
  })

  it('Ablehnung und Abbruch werden zu KiFehler', async () => {
    const c = anthropicClient({ apiKey: 'test', basisUrl })
    const a = {
      modell: STANDARD_MODELL,
      system: 's',
      nachricht: 'n',
      schema: Schema,
      maxTokens: 10,
    }
    antwort = { stop_reason: 'refusal', text: '' }
    await expect(c.erzeuge(a)).rejects.toMatchObject({ art: 'verweigert' })
    antwort = { stop_reason: 'max_tokens', text: '{"kategorie":' }
    await expect(c.erzeuge(a)).rejects.toBeInstanceOf(KiFehler)
  })

  it('ohne Schlüssel ist die KI aus; Modell aus der Umgebung', () => {
    expect(kiClientAusUmgebung({})).toBeNull()
    expect(kiClientAusUmgebung({ ANTHROPIC_API_KEY: '  ' })).toBeNull()
    expect(kiClientAusUmgebung({ ANTHROPIC_API_KEY: 'sk' })).not.toBeNull()
    expect(kiModell({})).toBe(STANDARD_MODELL)
    expect(kiModell({ KI_MODELL: 'claude-sonnet-5-5' })).toBe('claude-sonnet-5-5')
  })
})
