/**
 * Wer darf ein Konto anlegen? In Produktion nicht jeder, der die Domain kennt: nur Adressen aus
 * `REGISTRIERUNG_ERLAUBT` (Gründer des Mandanten) und Eingeladene mit offener Einladung
 * (Miteigentümer, Mitverwalter, Steuerberater). `REGISTRIERUNG=offen` schaltet das ab
 * (Tests, Entwicklung). Mieter brauchen kein Konto, sie nutzen das Portal.
 */
export type RegistrierungsModus = 'offen' | 'eingeladen'

export function registrierungsModus(env: Record<string, string | undefined>): RegistrierungsModus {
  const m = env['REGISTRIERUNG']
  if (m === 'offen' || m === 'eingeladen') return m
  return env['NODE_ENV'] === 'development' ? 'offen' : 'eingeladen'
}

export function erlaubteAdressen(liste: string | undefined): Set<string> {
  return new Set(
    (liste ?? '')
      .split(/[,\s]+/)
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function registrierungErlaubt(
  email: string,
  o: { modus: RegistrierungsModus; erlaubt: ReadonlySet<string>; eingeladen: boolean },
): boolean {
  return o.modus === 'offen' || o.eingeladen || o.erlaubt.has(email.trim().toLowerCase())
}
