import { createHmac } from 'node:crypto'

/** RFC 6238 TOTP (SHA-1, 6 Stellen, 30 s), damit der Test einen echten Code erzeugen kann. */
export function totp(geheimnisBase32: string, zeit = Date.now()): string {
  const schluessel = base32(geheimnisBase32)
  const zaehler = Math.floor(zeit / 1000 / 30)
  const puffer = Buffer.alloc(8)
  puffer.writeBigUInt64BE(BigInt(zaehler))
  const h = createHmac('sha1', schluessel).update(puffer).digest()
  const o = h[h.length - 1]! & 0x0f
  const zahl = ((h[o]! & 0x7f) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!
  return String(zahl % 1_000_000).padStart(6, '0')
}

function base32(s: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  const sauber = s.replace(/=+$/, '').toUpperCase()
  let bits = ''
  for (const c of sauber) {
    const v = alphabet.indexOf(c)
    if (v < 0) throw new Error(`kein Base32: ${c}`)
    bits += v.toString(2).padStart(5, '0')
  }
  const bytes: number[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2))
  return Buffer.from(bytes)
}
