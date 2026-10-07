import 'server-only'
import nodemailer, { type Transporter } from 'nodemailer'

/**
 * Mailversand über SMTP (WP 1.10), anbieterneutral: Brevo, Amazon SES oder der eigene
 * Mail-Hoster, nur die Umgebung entscheidet (docs/BETRIEB.md, „Mailversand“).
 *   SMTP_HOST, SMTP_PORT (Standard 587), SMTP_BENUTZER, SMTP_PASSWORT, MAIL_ABSENDER
 *   SMTP_TLS=aus nur für lokale Tests (GreenMail)
 * Ohne SMTP_HOST wird nichts verschickt; in der Entwicklung steht der Inhalt im Server-Log.
 */
let transport: Transporter | undefined

export function mailEingerichtet(): boolean {
  return Boolean(process.env['SMTP_HOST'])
}

function smtp(): Transporter {
  if (transport) return transport
  const port = Number(process.env['SMTP_PORT'] ?? 587)
  const ohneTls = process.env['SMTP_TLS'] === 'aus'
  const benutzer = process.env['SMTP_BENUTZER']
  transport = nodemailer.createTransport({
    host: process.env['SMTP_HOST'],
    port,
    secure: !ohneTls && port === 465,
    requireTLS: !ohneTls && port !== 465,
    ignoreTLS: ohneTls,
    auth: benutzer ? { user: benutzer, pass: process.env['SMTP_PASSWORT'] ?? '' } : undefined,
  })
  return transport
}

/**
 * Verschickt eine Textmail. Liefert false, wenn kein Versand eingerichtet ist oder der Server
 * ablehnt; der Fehler steht im Log, ohne Inhalt (Links in Mails sind Zugangsdaten).
 */
export async function sendeMail(m: {
  art: string
  an: string
  betreff: string
  text: string
}): Promise<boolean> {
  if (!mailEingerichtet()) {
    if (process.env.NODE_ENV !== 'production') console.log(`[mail:${m.art}] ${m.an}: ${m.text}`)
    else console.warn(`[mail:${m.art}] Mailversand nicht eingerichtet, keine Mail an ${m.an}`)
    return false
  }
  try {
    await smtp().sendMail({
      from: process.env['MAIL_ABSENDER'] ?? 'Vermieter.OS <noreply@localhost>',
      to: m.an,
      subject: m.betreff,
      text: m.text,
    })
    return true
  } catch (e) {
    console.error(
      `[mail:${m.art}] Versand an ${m.an} fehlgeschlagen: ${e instanceof Error ? e.message : e}`,
    )
    return false
  }
}
