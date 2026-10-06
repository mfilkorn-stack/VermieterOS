import { describe, expect, it } from 'vitest'
import { sicheresZiel } from './ziel'

describe('sicheresZiel', () => {
  it('lässt relative Pfade durch', () => {
    expect(sicheresZiel('/')).toBe('/')
    expect(sicheresZiel('/einladungen/abc?x=1')).toBe('/einladungen/abc?x=1')
    // Prozent-kodiert bleibt es ein Pfad dieser App.
    expect(sicheresZiel('/%5C%5Cboese')).toBe('/%5C%5Cboese')
  })
  it('verwirft alles, was die App verlassen könnte', () => {
    for (const z of [
      'https://boese.example',
      '//boese.example',
      '/\\boese.example',
      'javascript:alert(1)',
      '/pfad\\mit\\backslash',
      '/zeile\numbruch',
      '',
      undefined,
      42,
      '/' + 'a'.repeat(600),
    ]) {
      expect(sicheresZiel(z)).toBe('/')
    }
  })
  it('nutzt den Standardwert', () => {
    expect(sicheresZiel(null, '/mandanten')).toBe('/mandanten')
  })
})
