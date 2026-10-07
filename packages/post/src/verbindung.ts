import { ImapFlow } from 'imapflow'

/** Prüft Anmeldung und Ordner, bevor ein Postfach gespeichert wird. Liefert null oder einen Fehlertext. */
export async function pruefeVerbindung(p: {
  host: string
  port: number
  tls: boolean
  benutzer: string
  passwort: string
  ordner: string
}): Promise<string | null> {
  const client = new ImapFlow({
    host: p.host,
    port: p.port,
    secure: p.tls,
    auth: { user: p.benutzer, pass: p.passwort },
    logger: false,
    doSTARTTLS: p.tls ? undefined : false,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
  })
  try {
    await client.connect()
    await client.mailboxOpen(p.ordner, { readOnly: true })
    return null
  } catch (e) {
    const text = e instanceof Error ? e.message : String(e)
    const antwort = (e as { responseText?: string }).responseText
    return antwort ? `${text}: ${antwort}` : text
  } finally {
    await client.logout().catch(() => client.close())
  }
}
