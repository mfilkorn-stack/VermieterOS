import { simpleParser, type AddressObject } from 'mailparser'

/** Obergrenze für den gespeicherten Textteil; die vollständige Mail liegt als .eml im Speicher. */
const MAX_TEXT = 200_000

export type GeleseneMail = {
  messageId: string | null
  inReplyTo: string | null
  referenzen: string[]
  vonAdresse: string
  vonName: string | null
  an: string[]
  betreff: string
  gesendetAm: string | null
  text: string
  anhaenge: { dateiname: string; mimeTyp: string; inhalt: Buffer }[]
}

function adressen(a: AddressObject | AddressObject[] | undefined): string[] {
  const liste = Array.isArray(a) ? a : a ? [a] : []
  return liste.flatMap((x) => x.value.map((v) => (v.address ?? '').toLowerCase())).filter(Boolean)
}

function liste(x: string | string[] | undefined): string[] {
  if (!x) return []
  return (Array.isArray(x) ? x : x.split(/\s+/)).map((s) => s.trim()).filter(Boolean)
}

export async function liesMail(roh: Buffer): Promise<GeleseneMail> {
  const m = await simpleParser(roh, { skipImageLinks: true, skipTextToHtml: true })
  const von = m.from?.value[0]
  return {
    messageId: m.messageId ?? null,
    inReplyTo: liste(m.inReplyTo)[0] ?? null,
    referenzen: liste(m.references),
    vonAdresse: (von?.address ?? '').toLowerCase() || 'unbekannt',
    vonName: von?.name || null,
    an: [...adressen(m.to), ...adressen(m.cc)],
    betreff: (m.subject ?? '').slice(0, 1000),
    gesendetAm: m.date && !Number.isNaN(m.date.getTime()) ? m.date.toISOString() : null,
    text: (m.text ?? '').slice(0, MAX_TEXT),
    anhaenge: m.attachments
      // Eingebettete Bilder aus HTML-Signaturen (cid) sind keine Anhänge; sie bleiben in der .eml.
      .filter((a) => !a.related)
      .map((a, i) => ({
        dateiname: a.filename ?? `anhang-${i + 1}`,
        mimeTyp: a.contentType || 'application/octet-stream',
        inhalt: a.content,
      })),
  }
}
