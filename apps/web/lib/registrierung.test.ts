import { describe, expect, it } from 'vitest'
import { erlaubteAdressen, registrierungErlaubt, registrierungsModus } from './registrierung'

describe('Registrierung', () => {
  it('in Produktion standardmäßig nur mit Einladung oder Freigabe', () => {
    expect(registrierungsModus({ NODE_ENV: 'production' })).toBe('eingeladen')
    expect(registrierungsModus({ NODE_ENV: 'development' })).toBe('offen')
    expect(registrierungsModus({ NODE_ENV: 'production', REGISTRIERUNG: 'offen' })).toBe('offen')
    expect(registrierungsModus({ REGISTRIERUNG: 'quatsch' })).toBe('eingeladen')
  })

  it('Freigabeliste ohne Groß-/Kleinschreibung, Einladung reicht', () => {
    const erlaubt = erlaubteAdressen(' Gruender@Example.org, zweite@example.org ')
    const basis = { modus: 'eingeladen' as const, erlaubt, eingeladen: false }
    expect(registrierungErlaubt('gruender@example.org', basis)).toBe(true)
    expect(registrierungErlaubt('fremd@example.org', basis)).toBe(false)
    expect(registrierungErlaubt('fremd@example.org', { ...basis, eingeladen: true })).toBe(true)
    expect(registrierungErlaubt('fremd@example.org', { ...basis, modus: 'offen' })).toBe(true)
  })
})
