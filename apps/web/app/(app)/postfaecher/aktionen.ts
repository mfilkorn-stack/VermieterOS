'use server'

import { aenderePostfach, legePostfachAn } from '@vermieteros/db'
import { pruefeVerbindung, schluesselAusUmgebung, verschluessele } from '@vermieteros/post'
import { redirect } from 'next/navigation'
import { datum, Eingabefehler, ganz, haken, pflicht, text } from '@/lib/eingabe'
import { fehlertext, type FormStatus } from '@/lib/form-status'
import { mitMandant, verlange } from '@/lib/sitzung'

function einstellungen(d: FormData) {
  const port = ganz(d, 'port', 'Port') ?? 993
  if (port < 1 || port > 65535) throw new Eingabefehler('Port: 1 bis 65535.')
  return {
    bezeichnung: pflicht(d, 'bezeichnung', 'Bezeichnung'),
    host: pflicht(d, 'host', 'Server'),
    port,
    tls: haken(d, 'tls'),
    benutzer: pflicht(d, 'benutzer', 'Benutzer'),
    ordner: text(d, 'ordner') ?? 'INBOX',
  }
}

export async function postfachAnlegen(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ post: ['postfaecher'] })
    const e = einstellungen(d)
    const passwort = pflicht(d, 'passwort', 'Passwort')
    const abrufAb = datum(d, 'abrufAb', 'Abruf ab')
    if (!abrufAb) throw new Eingabefehler('Abruf ab fehlt.')
    const fehler = await pruefeVerbindung({ ...e, passwort })
    if (fehler) throw new Eingabefehler(`Verbindung fehlgeschlagen: ${fehler}`)
    const passwortChiffre = verschluessele(passwort, schluesselAusUmgebung())
    await mitMandant((tx, k) =>
      legePostfachAn(tx, {
        ...e,
        abrufAb,
        passwortChiffre,
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/postfaecher')
}

/** Aktivieren, deaktivieren oder Passwort ersetzen. Ein neues Passwort wird vorher geprüft. */
export async function postfachAendern(_: FormStatus, d: FormData): Promise<FormStatus> {
  try {
    await verlange({ post: ['postfaecher'] })
    const id = pflicht(d, 'postfachId', 'Postfach')
    const passwort = text(d, 'passwort')
    const aktiv =
      d.get('aktion') === 'aktivieren'
        ? true
        : d.get('aktion') === 'deaktivieren'
          ? false
          : undefined
    let passwortChiffre: string | undefined
    if (passwort) {
      const e = einstellungen(d)
      const fehler = await pruefeVerbindung({ ...e, passwort })
      if (fehler) throw new Eingabefehler(`Verbindung fehlgeschlagen: ${fehler}`)
      passwortChiffre = verschluessele(passwort, schluesselAusUmgebung())
    }
    if (aktiv === undefined && !passwortChiffre) throw new Eingabefehler('Nichts zu ändern.')
    await mitMandant((tx, k) =>
      aenderePostfach(tx, {
        id,
        mandantId: k.mandantId,
        akteur: { art: 'nutzer', id: k.nutzerId },
        ...(aktiv !== undefined ? { aktiv } : {}),
        ...(passwortChiffre ? { passwortChiffre } : {}),
      }),
    )
  } catch (e) {
    return { fehler: fehlertext(e) }
  }
  redirect('/postfaecher')
}
