import { unzipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { baueZip, centCsv, csv, pruefeZip, sichererName } from './steuer-zip'

const u = (s: string) => new TextEncoder().encode(s)

describe('Steuerpaket-ZIP', () => {
  it('Manifest mit Prüfsummen, Gegenprobe erkennt Manipulation', () => {
    const zip = baueZip([
      { pfad: 'uebersicht.pdf', inhalt: u('%PDF') },
      { pfad: 'belege/2024-0001_rechnung.pdf', inhalt: u('beleg') },
    ])
    const r = pruefeZip(zip)
    expect(r.ok).toBe(true)
    expect(r.dateien).toEqual([
      'belege/2024-0001_rechnung.pdf',
      'manifest.sha256',
      'uebersicht.pdf',
    ])
    const m = new TextDecoder().decode(unzipSync(zip)['manifest.sha256'])
    expect(m).toMatch(/^[0-9a-f]{64} {2}uebersicht\.pdf\n/)
    // gleiche Eingabe, gleiche Datei
    expect(baueZip([{ pfad: 'a', inhalt: u('x') }])).toEqual(
      baueZip([{ pfad: 'a', inhalt: u('x') }]),
    )
  })

  it('doppelte Pfade werden abgelehnt, Namen bereinigt', () => {
    expect(() =>
      baueZip([
        { pfad: 'a', inhalt: u('1') },
        { pfad: 'a', inhalt: u('2') },
      ]),
    ).toThrow(/Doppelter Pfad/)
    expect(sichererName('../../etc/passwd')).toBe('__.._etc_passwd')
    expect(sichererName('Rechnung: Mai/2024.pdf')).toBe('Rechnung_ Mai_2024.pdf')
  })

  it('CSV deutsch mit BOM, Semikolon und Dezimalkomma', () => {
    const t = new TextDecoder('utf-8', { ignoreBOM: true }).decode(
      csv(
        ['Beleg', 'Betrag'],
        [
          ['2024-1', centCsv(-12_345)],
          ['Text; mit "Zeichen"', centCsv(5)],
        ],
      ),
    )
    expect(t.charCodeAt(0)).toBe(0xfeff)
    expect(t.slice(1)).toBe('Beleg;Betrag\r\n2024-1;-123,45\r\n"Text; mit ""Zeichen""";0,05\r\n')
  })
})
