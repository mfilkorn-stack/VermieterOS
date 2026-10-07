import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

/**
 * Verschlüsselung der Postfach-Passwörter (AES-256-GCM). Der Schlüssel kommt aus
 * `POSTFACH_SCHLUESSEL` (32 Byte, base64) und liegt nie in der Datenbank.
 * Format: v1.<iv>.<tag>.<chiffre>, jeweils base64url.
 */
const AAD = Buffer.from('vermieteros:postfach:v1')

export function schluesselAusUmgebung(wert = process.env['POSTFACH_SCHLUESSEL']): Buffer {
  if (!wert) throw new Error('POSTFACH_SCHLUESSEL fehlt (32 Byte, base64: openssl rand -base64 32)')
  const k = Buffer.from(wert, 'base64')
  if (k.length !== 32) throw new Error('POSTFACH_SCHLUESSEL muss 32 Byte lang sein (base64)')
  return k
}

export function verschluessele(klartext: string, schluessel: Buffer): string {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', schluessel, iv)
  c.setAAD(AAD)
  const chiffre = Buffer.concat([c.update(klartext, 'utf8'), c.final()])
  return ['v1', iv, c.getAuthTag(), chiffre]
    .map((t) => (typeof t === 'string' ? t : t.toString('base64url')))
    .join('.')
}

export function entschluessele(text: string, schluessel: Buffer): string {
  const [v, iv, tag, chiffre] = text.split('.')
  if (v !== 'v1' || !iv || !tag || chiffre === undefined)
    throw new Error('Unbekanntes Chiffre-Format')
  const d = createDecipheriv('aes-256-gcm', schluessel, Buffer.from(iv, 'base64url'))
  d.setAAD(AAD)
  d.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([d.update(Buffer.from(chiffre, 'base64url')), d.final()]).toString('utf8')
}
