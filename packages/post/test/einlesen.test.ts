import MailComposer from 'nodemailer/lib/mail-composer'
import { describe, expect, it } from 'vitest'
import { liesMail } from '../src/einlesen'

function baue(opts: ConstructorParameters<typeof MailComposer>[0]): Promise<Buffer> {
  return new MailComposer(opts).compile().build()
}

describe('liesMail', () => {
  it('Kopfdaten, Text, Anhänge; eingebettete Signaturbilder sind keine Anhänge', async () => {
    const roh = await baue({
      from: 'Erika Mieterin <Erika@Example.org>',
      to: 'vermietung@example.org',
      cc: 'partner@example.org',
      subject: 'Wasserschaden Bad',
      messageId: '<m2@example.org>',
      inReplyTo: '<m1@example.org>',
      references: ['<m0@example.org>', '<m1@example.org>'],
      date: new Date('2026-10-01T08:00:00Z'),
      text: 'Im Bad tropft es.',
      html: '<p>Im Bad tropft es.</p><img src="cid:logo">',
      attachments: [
        { filename: 'foto.jpg', content: Buffer.from('jpeg'), contentType: 'image/jpeg' },
        {
          filename: 'logo.png',
          content: Buffer.from('png'),
          contentType: 'image/png',
          cid: 'logo',
        },
      ],
    })
    const m = await liesMail(roh)
    expect(m).toMatchObject({
      messageId: '<m2@example.org>',
      inReplyTo: '<m1@example.org>',
      referenzen: ['<m0@example.org>', '<m1@example.org>'],
      vonAdresse: 'erika@example.org',
      vonName: 'Erika Mieterin',
      an: ['vermietung@example.org', 'partner@example.org'],
      betreff: 'Wasserschaden Bad',
      gesendetAm: '2026-10-01T08:00:00.000Z',
    })
    expect(m.text.trim()).toBe('Im Bad tropft es.')
    expect(m.anhaenge.map((a) => [a.dateiname, a.mimeTyp, a.inhalt.toString()])).toEqual([
      ['foto.jpg', 'image/jpeg', 'jpeg'],
    ])
  })

  it('nur HTML: Text wird erzeugt; fehlende Kopfdaten sind kein Fehler', async () => {
    const roh = Buffer.from(
      'Subject: Hallo\r\nContent-Type: text/html; charset=utf-8\r\n\r\n<p>Nur <b>HTML</b></p>\r\n',
    )
    const m = await liesMail(roh)
    expect(m.vonAdresse).toBe('unbekannt')
    expect(m.messageId).toBeNull()
    expect(m.gesendetAm).toBeNull()
    expect(m.text).toContain('Nur HTML')
  })
})
