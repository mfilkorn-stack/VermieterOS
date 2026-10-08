import { ImapFlow } from 'imapflow'
import { simpleParser } from 'mailparser'
import { E2E } from './umgebung'

/**
 * Wartet, bis in GreenMail eine Mail an `an` mit passendem Betreff liegt, und liefert ihren Text.
 * GreenMail legt Postfächer beim ersten Empfang an; ohne Prüfung gilt jedes Passwort.
 */
export async function warteAufMail(an: string, betreff: RegExp, ms = 20_000): Promise<string> {
  const ende = Date.now() + ms
  while (Date.now() < ende) {
    const c = new ImapFlow({
      host: E2E.imap.host,
      port: E2E.imap.port,
      secure: false,
      auth: { user: an, pass: 'egal' },
      logger: false,
    })
    try {
      await c.connect()
      const lock = await c.getMailboxLock('INBOX')
      try {
        const treffer: string[] = []
        for await (const m of c.fetch('1:*', { source: true })) {
          const mail = await simpleParser(m.source!)
          if (betreff.test(mail.subject ?? '')) treffer.push(mail.text ?? '')
        }
        if (treffer.length) return treffer.at(-1)!
      } finally {
        lock.release()
      }
    } catch {
      // Postfach gibt es noch nicht: weiter warten
    } finally {
      await c.logout().catch(() => {})
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Keine Mail an ${an} mit Betreff ${betreff}`)
}

/** Wie `warteAufMail`, liefert aber auch die Kopfzeilen, die eine Antwort in den Thread hängen. */
export async function warteAufMailKopf(
  an: string,
  betreff: RegExp,
  ms = 20_000,
): Promise<{ text: string; replyTo: string | null; inReplyTo: string | null }> {
  const ende = Date.now() + ms
  while (Date.now() < ende) {
    const c = new ImapFlow({
      host: E2E.imap.host,
      port: E2E.imap.port,
      secure: false,
      auth: { user: an, pass: 'egal' },
      logger: false,
    })
    try {
      await c.connect()
      const lock = await c.getMailboxLock('INBOX')
      try {
        for await (const m of c.fetch('1:*', { source: true })) {
          const mail = await simpleParser(m.source!)
          if (betreff.test(mail.subject ?? ''))
            return {
              text: mail.text ?? '',
              replyTo: mail.replyTo?.value[0]?.address ?? null,
              inReplyTo: mail.inReplyTo ?? null,
            }
        }
      } finally {
        lock.release()
      }
    } catch {
      // Postfach gibt es noch nicht: weiter warten
    } finally {
      await c.logout().catch(() => {})
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Keine Mail an ${an} mit Betreff ${betreff}`)
}

export function portalLinkAus(text: string): string {
  const m = /https?:\/\/\S+\/portal\/anmelden\?token=[\w%-]+/.exec(text)
  if (!m) throw new Error('Kein Anmeldelink in der Mail')
  return m[0]
}
