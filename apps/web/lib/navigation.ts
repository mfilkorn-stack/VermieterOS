import 'server-only'
import {
  gemeldeteTickets,
  offeneBelege,
  offeneNachrichten,
  schema,
  withMandant,
} from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import type { NavEintrag } from '@/components/navigation'
import { DRINGEND, ladeBkFristen } from './bk-fristen'
import { db } from './db'
import { ROLLEN_TEXT, roles } from './rechte'
import { mandantOderNull } from './sitzung'

export type Navigation = {
  mandant: { name: string; rolle: string } | null
  haupt: NavEintrag[]
  verwaltung: NavEintrag[]
  tabs: NavEintrag[]
}

const MEHR_BEREICHE = [
  '/mehr',
  '/journal',
  '/betriebskosten',
  '/handwerker',
  '/eigentuemer',
  '/mitglieder',
  '/postfaecher',
  '/referenzdaten',
  '/mandanten',
]

/**
 * Menü des aktiven Mandanten mit Zählern. Zähler nur, wo sie etwas aussagen:
 * offene Mails, neue Tickets und offene Belege (Handlung, Amber), Anzahl Objekte (Menge, Grau).
 */
export async function ladeNavigation(): Promise<Navigation> {
  const k = await mandantOderNull()
  if (!k) {
    return {
      mandant: null,
      haupt: [],
      verwaltung: [],
      tabs: [{ href: '/mandanten', label: 'Mandanten', icon: 'mandanten' }],
    }
  }
  const rolle = roles[k.rolle]
  const post = rolle.authorize({ post: ['lesen'] }).success
  const postfaecher = rolle.authorize({ post: ['postfaecher'] }).success

  const daten = await withMandant(db, k.mandantId, async (tx) => {
    const [m] = await tx.select({ name: schema.mandanten.name }).from(schema.mandanten)
    const [o] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from objekte_aktuell`)
    return {
      name: m?.name ?? '',
      objekte: o?.n ?? 0,
      offen: post ? await offeneNachrichten(tx) : 0,
      tickets: await gemeldeteTickets(tx),
      belege: await offeneBelege(tx),
      fristen: (await ladeBkFristen(tx)).filter((f) => DRINGEND.has(f.stufe)).length,
    }
  })

  const objekte: NavEintrag = {
    href: '/',
    label: 'Objekte',
    icon: 'objekte',
    bereiche: ['/', '/objekte', '/mietverhaeltnisse'],
    zaehler: { n: daten.objekte, art: 'menge', text: daten.objekte === 1 ? 'Objekt' : 'Objekte' },
  }
  const posteingang: NavEintrag[] = post
    ? [
        {
          href: '/posteingang',
          label: 'Posteingang',
          icon: 'posteingang',
          zaehler: { n: daten.offen, art: 'handlung', text: 'offen' },
        },
      ]
    : []
  const tickets: NavEintrag = {
    href: '/tickets',
    label: 'Tickets',
    icon: 'tickets',
    zaehler: { n: daten.tickets, art: 'handlung', text: 'neu gemeldet' },
  }
  const belege: NavEintrag = {
    href: '/belege',
    label: 'Belege',
    icon: 'belege',
    zaehler: { n: daten.belege, art: 'handlung', text: 'offen' },
  }
  const journal: NavEintrag = { href: '/journal', label: 'Journal', icon: 'journal' }
  const betriebskosten: NavEintrag = {
    href: '/betriebskosten',
    label: 'Betriebskosten',
    icon: 'betriebskosten',
    zaehler: { n: daten.fristen, art: 'handlung', text: 'Frist in Sicht oder abgelaufen' },
  }
  const verwaltung: NavEintrag[] = [
    { href: '/handwerker', label: 'Handwerker', icon: 'handwerker' },
    { href: '/eigentuemer', label: 'Eigentümer', icon: 'eigentuemer' },
    { href: '/mitglieder', label: 'Mitglieder', icon: 'mitglieder' },
    ...(postfaecher
      ? [{ href: '/postfaecher', label: 'Postfächer', icon: 'postfaecher' } as const]
      : []),
    { href: '/referenzdaten', label: 'Referenzdaten', icon: 'referenzdaten' },
  ]
  return {
    mandant: { name: daten.name, rolle: ROLLEN_TEXT[k.rolle].split(' (')[0]! },
    haupt: [objekte, ...posteingang, tickets, belege, betriebskosten, journal],
    verwaltung,
    tabs: [
      objekte,
      ...posteingang,
      tickets,
      belege,
      { href: '/mehr', label: 'Mehr', icon: 'mehr', bereiche: MEHR_BEREICHE },
    ],
  }
}
