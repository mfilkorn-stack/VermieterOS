import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

const SMTP = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_TLS'] as const
const vorher = Object.fromEntries(SMTP.map((k) => [k, process.env[k]]))

async function pruefe(env: Partial<Record<(typeof SMTP)[number], string>>) {
  for (const k of SMTP) delete process.env[k]
  Object.assign(process.env, env)
  vi.resetModules() // der Transport wird im Modul zwischengespeichert
  const { pruefeMailVersand } = await import('./mail')
  return pruefeMailVersand()
}

afterEach(() => {
  for (const k of SMTP) {
    if (vorher[k] === undefined) delete process.env[k]
    else process.env[k] = vorher[k]
  }
})

describe('pruefeMailVersand', () => {
  it('ohne SMTP_HOST: nicht eingerichtet', async () => {
    expect(await pruefe({})).toEqual({ ok: false, meldung: 'nicht eingerichtet (SMTP_HOST fehlt)' })
  })

  it('Tippfehler im Host fällt sofort auf', async () => {
    const r = await pruefe({ SMTP_HOST: 'smpt.invalid', SMTP_PORT: '587' })
    expect(r.ok).toBe(false)
    expect(r.meldung).toMatch(/^smpt\.invalid:587 nicht erreichbar: .*ENOTFOUND/)
  })

  it('erreichbarer Server (GreenMail): bereit', async () => {
    const r = await pruefe({ SMTP_HOST: '127.0.0.1', SMTP_PORT: '3025', SMTP_TLS: 'aus' })
    expect(r).toEqual({ ok: true, meldung: 'bereit (127.0.0.1:3025)' })
  })
})
