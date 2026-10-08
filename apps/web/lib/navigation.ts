import 'server-only'
import {
  gemeldeteTickets,
  offeneBelege,
  offeneNachrichten,
  schema,
  withMandant,
  type Tx,
} from '@vermieteros/db'
import { sql } from 'drizzle-orm'
import type { NavEintrag } from '@/components/navigation'
import { DRINGEND, ladeBkFristen } from './bk-fristen'
import { offeneAbschlussPunkte } from './jahresabschluss'
import { db } from './db'
import { ROLLEN_TEXT, roles, type Rolle } from './rechte'
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
  '/steuer',
  '/jahresabschluss',
  '/handwerker',
  '/eigentuemer',
  '/mitglieder',
  '/postfaecher',
  '/referenzdaten',
  '/mandanten',
]

export type Zaehler = {
  objekte: number
  offen: number
  tickets: number
  belege: number
  fristen: number
  abschluss: number
}

/** Alle Zähler des Menüs; auch die Startseite zeigt sie als „Zu erledigen“. */
export async function ladeZaehler(tx: Tx, post: boolean): Promise<Zaehler> {
  const [o] = await tx.execute<{ n: number }>(sql`select count(*)::int as n from objekte_aktuell`)
  return {
    objekte: o?.n ?? 0,
    offen: post ? await offeneNachrichten(tx) : 0,
    tickets: await gemeldeteTickets(tx),
    belege: await offeneBelege(tx),
    fristen: (await ladeBkFristen(tx)).filter((f) => DRINGEND.has(f.stufe)).length,
    abschluss: await offeneAbschlussPunkte(tx),
  }
}

/** Menüeinträge mit Handlungszählern > 0, in der Reihenfolge des Menüs. */
export function zuErledigen(z: Zaehler, rolle: Rolle): NavEintrag[] {
  const post = roles[rolle].authorize({ post: ['lesen'] }).success
  return eintraege(z, post).haupt.filter((e) => e.zaehler?.art === 'handlung' && e.zaehler.n > 0)
}

function eintraege(daten: Zaehler, post: boolean) {
  const start: NavEintrag = { href: '/', label: 'Übersicht', icon: 'start', bereiche: ['/'] }
  const objekte: NavEintrag = {
    href: '/objekte',
    label: 'Objekte',
    icon: 'objekte',
    zaehler: { n: daten.objekte, art: 'menge', text: daten.objekte === 1 ? 'Objekt' : 'Objekte' },
  }
  const mieter: NavEintrag = { href: '/mietverhaeltnisse', label: 'Mieter', icon: 'mieter' }
  const posteingang: NavEintrag[] = post
    ? [
        {
          href: '/posteingang',
          label: 'Posteingang',
          icon: 'posteingang',
          zaehler: { n: daten.offen, art: 'handlung', text: 'nicht zugeordnet' },
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
  const steuer: NavEintrag = { href: '/steuer', label: 'Steuer', icon: 'steuer' }
  const abschluss: NavEintrag = {
    href: '/jahresabschluss',
    label: 'Jahresabschluss',
    icon: 'jahresabschluss',
    zaehler: { n: daten.abschluss, art: 'handlung', text: 'offen' },
  }
  return {
    start,
    objekte,
    mieter,
    posteingang,
    tickets,
    belege,
    journal,
    betriebskosten,
    steuer,
    abschluss,
    haupt: [
      start,
      objekte,
      mieter,
      ...posteingang,
      tickets,
      belege,
      betriebskosten,
      journal,
      steuer,
      abschluss,
    ] as NavEintrag[],
  }
}

/**
 * Menü des aktiven Mandanten mit Zählern. Zähler nur, wo sie etwas aussagen:
 * Handlung (Amber) für Mails, Tickets, Belege, Fristen und Abschluss, Menge (Grau) für Objekte.
 * Tabs je Rolle: Steuerberater bekommt Belege, Journal und Steuer statt Posteingang und Tickets.
 * Der Tab „Mehr“ trägt die Summe der Handlungszähler, die hinter ihm liegen.
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
    return { name: m?.name ?? '', ...(await ladeZaehler(tx, post)) }
  })
  const e = eintraege(daten, post)
  const verwaltung: NavEintrag[] = [
    { href: '/handwerker', label: 'Handwerker', icon: 'handwerker' },
    { href: '/eigentuemer', label: 'Eigentümer', icon: 'eigentuemer' },
    { href: '/mitglieder', label: 'Mitglieder', icon: 'mitglieder' },
    ...(postfaecher
      ? [{ href: '/postfaecher', label: 'Postfächer', icon: 'postfaecher' } as const]
      : []),
    { href: '/referenzdaten', label: 'Referenzdaten', icon: 'referenzdaten' },
  ]
  const vorneTabs: NavEintrag[] =
    k.rolle === 'steuerberater'
      ? [e.objekte, e.belege, e.journal, e.steuer]
      : [e.start, e.objekte, ...e.posteingang, e.tickets]
  const hinten = e.haupt.filter((x) => !vorneTabs.includes(x))
  const summe = hinten.reduce((n, x) => n + (x.zaehler?.art === 'handlung' ? x.zaehler.n : 0), 0)
  return {
    mandant: { name: daten.name, rolle: ROLLEN_TEXT[k.rolle].split(' (')[0]! },
    haupt: e.haupt,
    verwaltung,
    tabs: [
      ...vorneTabs,
      {
        href: '/mehr',
        label: 'Mehr',
        icon: 'mehr',
        bereiche: [...MEHR_BEREICHE, ...hinten.map((x) => x.href)],
        zaehler: { n: summe, art: 'handlung', text: 'zu erledigen' },
      },
    ],
  }
}
