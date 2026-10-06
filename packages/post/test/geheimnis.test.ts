import { randomBytes } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { entschluessele, schluesselAusUmgebung, verschluessele } from '../src/geheimnis'

describe('Postfach-Passwörter', () => {
  const s = randomBytes(32)

  it('Hin und zurück, jedes Mal anderer IV', () => {
    const a = verschluessele('geheim äöü', s)
    const b = verschluessele('geheim äöü', s)
    expect(a).not.toBe(b)
    expect(a.startsWith('v1.')).toBe(true)
    expect(entschluessele(a, s)).toBe('geheim äöü')
  })

  it('veränderte Chiffre oder falscher Schlüssel scheitern', () => {
    const c = verschluessele('geheim', s)
    const teile = c.split('.')
    teile[3] = Buffer.from('anders').toString('base64url')
    expect(() => entschluessele(teile.join('.'), s)).toThrow()
    expect(() => entschluessele(c, randomBytes(32))).toThrow()
  })

  it('Schlüssel aus der Umgebung muss 32 Byte haben', () => {
    expect(() => schluesselAusUmgebung(undefined)).toThrow(/fehlt/)
    expect(() => schluesselAusUmgebung(randomBytes(16).toString('base64'))).toThrow(/32 Byte/)
    expect(schluesselAusUmgebung(s.toString('base64')).equals(s)).toBe(true)
  })
})
