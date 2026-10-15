import type { Rechte } from './sitzung'

/**
 * Menübereiche: verwandte Seiten unter einem Eintrag, auf der Seite als Reiter. Die Adressen
 * bleiben, nur das Menü wird schlanker. Ein Reiter erscheint nur mit dem nötigen Leserecht.
 */
export type BereichSeite = { href: string; label: string; recht?: Rechte }

export const BEREICHE = {
  // Häuser und Eigentumswohnungen stehen direkt auf der Übersicht, ihre Akten unter /objekte/…
  bestand: [
    { href: '/', label: 'Übersicht' },
    { href: '/mietverhaeltnisse', label: 'Mieter', recht: { stammdaten: ['lesen'] } },
    { href: '/dokumente', label: 'Dokumente', recht: { stammdaten: ['lesen'] } },
  ],
  tickets: [
    { href: '/tickets', label: 'Tickets' },
    { href: '/handwerker', label: 'Handwerker' },
  ],
  finanzen: [
    { href: '/belege', label: 'Belege' },
    { href: '/journal', label: 'Journal' },
    { href: '/betriebskosten', label: 'Betriebskosten', recht: { stammdaten: ['lesen'] } },
  ],
  abschluss: [
    { href: '/jahresabschluss', label: 'Jahresabschluss', recht: { stammdaten: ['lesen'] } },
    { href: '/steuer', label: 'Steuer', recht: { stammdaten: ['lesen'] } },
  ],
  einstellungen: [
    { href: '/profil', label: 'Profil' },
    { href: '/eigentuemer', label: 'Eigentümer' },
    { href: '/mitglieder', label: 'Zugänge' },
    { href: '/postfaecher', label: 'Postfächer', recht: { post: ['postfaecher'] } },
    { href: '/referenzdaten', label: 'Referenzdaten' },
  ],
} satisfies Record<string, BereichSeite[]>

export type BereichName = keyof typeof BEREICHE

/** Alle Adressen eines Bereichs, für die Markierung im Menü. */
export function bereichPfade(b: BereichName): string[] {
  return BEREICHE[b].map((s) => s.href)
}
