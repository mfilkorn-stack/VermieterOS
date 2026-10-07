import { createAccessControl } from 'better-auth/plugins/access'
import { defaultStatements, ownerAc } from 'better-auth/plugins/organization/access'

/**
 * Rollen pro Mandanten-Mitgliedschaft (PLAN.md 3.1). Better-Auth-Statements für
 * Organisation, Mitglieder und Einladungen, ergänzt um fachliche Rechte.
 */
export const statements = {
  ...defaultStatements,
  stammdaten: ['lesen', 'schreiben'],
  export: ['steuerpaket'],
  /** Mail-Eingang und Verlauf: lesen, zuordnen, Telefonnotizen, Postfächer einrichten (Zugangsdaten). */
  post: ['lesen', 'zuordnen', 'notieren', 'postfaecher'],
} as const

export const ac = createAccessControl(statements)

export const ROLLEN = ['eigentuemer', 'miteigentuemer', 'mitverwalter', 'steuerberater'] as const
export type Rolle = (typeof ROLLEN)[number]

export const ROLLEN_TEXT: Record<Rolle, string> = {
  eigentuemer: 'Eigentümer',
  miteigentuemer: 'Miteigentümer',
  mitverwalter: 'Mitverwalter',
  steuerberater: 'Steuerberater (nur lesen, Export, keine Mails)',
}

export const roles = {
  /** Legt den Mandanten an, verwaltet Mitglieder und Einladungen, darf alles. */
  eigentuemer: ac.newRole({
    ...ownerAc.statements,
    stammdaten: ['lesen', 'schreiben'],
    export: ['steuerpaket'],
    post: ['lesen', 'zuordnen', 'notieren', 'postfaecher'],
  }),
  miteigentuemer: ac.newRole({
    stammdaten: ['lesen', 'schreiben'],
    export: ['steuerpaket'],
    post: ['lesen', 'zuordnen', 'notieren', 'postfaecher'],
  }),
  /** Arbeitet den Posteingang ab, richtet aber keine Postfächer ein. */
  mitverwalter: ac.newRole({
    stammdaten: ['lesen', 'schreiben'],
    post: ['lesen', 'zuordnen', 'notieren'],
  }),
  steuerberater: ac.newRole({
    stammdaten: ['lesen'],
    export: ['steuerpaket'],
  }),
}

export function istRolle(x: string): x is Rolle {
  return (ROLLEN as readonly string[]).includes(x)
}
