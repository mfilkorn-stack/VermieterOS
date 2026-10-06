import { APIError } from 'better-auth/api'

export type FormStatus = { fehler?: string; hinweis?: string }

const MELDUNGEN: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'E-Mail oder Passwort ist falsch.',
  USER_ALREADY_EXISTS: 'Zu dieser E-Mail gibt es schon ein Konto.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Zu dieser E-Mail gibt es schon ein Konto.',
  PASSWORD_TOO_SHORT: 'Das Passwort ist zu kurz (mindestens 12 Zeichen).',
  INVALID_PASSWORD: 'Das Passwort ist falsch.',
  INVALID_CODE: 'Der Code stimmt nicht.',
  INVALID_TWO_FACTOR_COOKIE: 'Die Anmeldung ist abgelaufen. Bitte neu anmelden.',
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: 'Die Person ist schon Mitglied.',
  USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: 'Die Person ist schon eingeladen.',
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: 'Keine Berechtigung zum Einladen.',
  ORGANIZATION_ALREADY_EXISTS: 'Diesen Mandanten gibt es schon.',
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: 'Die Einladung gilt für eine andere E-Mail.',
  INVITATION_NOT_FOUND: 'Die Einladung gibt es nicht oder sie ist abgelaufen.',
  EMAIL_VERIFICATION_REQUIRED_FOR_INVITATION:
    'Bitte zuerst die E-Mail-Adresse bestätigen (unter Sicherheit).',
}

/** Fehler aus Better Auth oder eigenem Code als Text für die Oberfläche. */
export function fehlertext(e: unknown): string {
  if (e instanceof APIError) {
    const code = (e.body as { code?: string } | undefined)?.code
    if (code && MELDUNGEN[code]) return MELDUNGEN[code]
    return (e.body as { message?: string } | undefined)?.message ?? e.message
  }
  if (e instanceof Error) {
    // Drizzle verpackt Datenbankfehler; die verständliche Meldung steht in `cause`.
    const ursache = (e as { cause?: { message?: string } }).cause?.message
    if (e.message.startsWith('Failed query') && ursache) return ursache
    return e.message
  }
  return 'Unbekannter Fehler'
}

export function feld(daten: FormData, name: string): string {
  const v = daten.get(name)
  return typeof v === 'string' ? v.trim() : ''
}
