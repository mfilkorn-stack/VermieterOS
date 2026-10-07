import { createHash } from 'node:crypto'
import { strToU8, unzipSync, zipSync } from 'fflate'

/**
 * Inhalt des Steuerpakets (WP 2.6) als ZIP: Dateien unter festen Pfaden und eine Liste der
 * SHA-256-Prüfsummen (`manifest.sha256`, Format von `sha256sum`), damit der Steuerberater die
 * Vollständigkeit prüfen kann (`sha256sum -c manifest.sha256`).
 */

export type PaketDatei = { pfad: string; inhalt: Uint8Array }

const hex = (b: Uint8Array) => createHash('sha256').update(b).digest('hex')

/** Dateiname ohne Pfad- und Steuerzeichen, damit kein Eintrag aus dem Ordner ausbricht. */
export function sichererName(name: string): string {
  const s = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/^\.+/, '_')
    .trim()
  return s.slice(0, 120) || 'datei'
}

export function baueZip(dateien: readonly PaketDatei[]): Uint8Array {
  const pfade = new Set<string>()
  for (const d of dateien) {
    if (pfade.has(d.pfad)) throw new Error(`Doppelter Pfad im Paket: ${d.pfad}`)
    pfade.add(d.pfad)
  }
  const manifest = dateien.map((d) => `${hex(d.inhalt)}  ${d.pfad}`).join('\n') + '\n'
  const eintraege: Record<string, Uint8Array> = {}
  // Feste Zeit: gleicher Inhalt ergibt dieselbe Datei
  const mtime = new Date('2000-01-01T00:00:00Z')
  for (const d of dateien) eintraege[d.pfad] = d.inhalt
  eintraege['manifest.sha256'] = strToU8(manifest)
  return zipSync(
    Object.fromEntries(Object.entries(eintraege).map(([p, b]) => [p, [b, { mtime }]])),
    { level: 6 },
  )
}

/** Gegenprobe: entpacken und jede Prüfsumme des Manifests nachrechnen. */
export function pruefeZip(zip: Uint8Array): { ok: boolean; dateien: string[] } {
  const inhalt = unzipSync(zip)
  const manifest = new TextDecoder().decode(inhalt['manifest.sha256'])
  const zeilen = manifest.trim().split('\n')
  let ok = zeilen.length === Object.keys(inhalt).length - 1
  for (const z of zeilen) {
    const [h, p] = [z.slice(0, 64), z.slice(66)]
    const b = inhalt[p]
    if (!b || hex(b) !== h) ok = false
  }
  return { ok, dateien: Object.keys(inhalt).sort() }
}

const BOM = '﻿'

/** CSV für Excel (deutsch): Semikolon, Dezimalkomma, UTF-8 mit BOM, Felder bei Bedarf in Anführung. */
export function csv(
  kopf: readonly string[],
  zeilen: ReadonlyArray<ReadonlyArray<string>>,
): Uint8Array {
  const feld = (s: string) => (/[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const text = [kopf, ...zeilen].map((z) => z.map(feld).join(';')).join('\r\n') + '\r\n'
  return strToU8(BOM + text)
}

export function centCsv(c: number): string {
  const v = Math.abs(c)
  return `${c < 0 ? '-' : ''}${Math.floor(v / 100)},${String(v % 100).padStart(2, '0')}`
}
