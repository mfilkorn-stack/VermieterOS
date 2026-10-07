import {
  ladePostfachFuerAbruf,
  ladeZuordnungsKandidaten,
  legeBelegeAusNachrichtAn,
  legeNachrichtAn,
  ordneNachrichtZu,
  setzeAbrufstand,
  withMandant,
  zuordnungImVerlauf,
  aktivePostfaecherAllerMandanten,
  type Db,
} from '@vermieteros/db'
import { ImapFlow } from 'imapflow'
import { liesMail } from './einlesen'
import { entschluessele } from './geheimnis'
import type { Speicher } from './speicher'
import { bestimmeZuordnung } from './zuordnung'

const WORKER = { art: 'system', id: 'mail-abruf' } as const

/** Kalendertag in Berlin (YYYY-MM-DD), unabhängig von der Zeitzone des Servers. */
function heuteBerlin(): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date())
}

export type AbrufErgebnis = {
  postfachId: string
  neu: number
  doppelt: number
  zugeordnet: number
  /** Nur Beleg-Postfächer: als Beleg abgelegte Anhänge */
  belege: number
  fehler: string | null
}

export type AbrufKontext = {
  /** Verbindung mit der Rolle vermieteros_worker */
  db: Db
  speicher: Speicher
  schluessel: Buffer
  log?: (text: string) => void
}

/**
 * Ruft ein Postfach ab. Der Ordner wird nur gelesen (EXAMINE): keine Flags, kein Löschen,
 * der Mailclient des Vermieters merkt nichts. Jede Nachricht ist eine eigene Transaktion;
 * der Abrufstand (letzte UID) wächst mit, ein Abbruch verliert nichts und doppelt nichts.
 */
export async function rufePostfachAb(
  ctx: AbrufKontext,
  postfach: { id: string; mandantId: string },
): Promise<AbrufErgebnis> {
  const log = ctx.log ?? (() => {})
  const ergebnis: AbrufErgebnis = {
    postfachId: postfach.id,
    neu: 0,
    doppelt: 0,
    zugeordnet: 0,
    belege: 0,
    fehler: null,
  }
  const pf = await withMandant(ctx.db, postfach.mandantId, (tx) =>
    ladePostfachFuerAbruf(tx, postfach.id),
  )
  if (!pf || !pf.aktiv) return ergebnis

  const client = new ImapFlow({
    host: pf.host,
    port: pf.port,
    secure: pf.tls,
    auth: { user: pf.benutzer, pass: entschluessele(pf.passwortChiffre, ctx.schluessel) },
    logger: false,
    // Ohne TLS nur für lokale Tests; STARTTLS nicht erzwingen.
    doSTARTTLS: pf.tls ? undefined : false,
  })
  try {
    await client.connect()
    const box = await client.mailboxOpen(pf.ordner, { readOnly: true })
    const uidValidity = Number(box.uidValidity)
    const neuerOrdner = pf.uidValidity !== null && pf.uidValidity !== uidValidity
    if (neuerOrdner) log(`${pf.bezeichnung}: UIDVALIDITY geändert, Abgleich über Prüfsummen`)
    const ab = neuerOrdner ? 0 : pf.letzteUid

    const gefunden =
      ab === 0
        ? await client.search({ since: new Date(`${pf.abrufAb}T00:00:00Z`) }, { uid: true })
        : await client.search({ uid: `${ab + 1}:*` }, { uid: true })
    // `n:*` liefert auch die letzte vorhandene UID, wenn sie kleiner als n ist.
    const uids = (gefunden || []).filter((u) => u > ab).sort((x, y) => x - y)

    const belegPostfach = pf.zweck === 'belege'
    const kandidaten =
      uids.length && !belegPostfach
        ? await withMandant(ctx.db, pf.mandantId, (tx) => ladeZuordnungsKandidaten(tx))
        : []

    for (const uid of uids) {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
      if (!msg || !msg.source) continue
      const roh = msg.source
      const mail = await liesMail(roh)
      const rohAblage = await ctx.speicher.ablegen(pf.mandantId, 'roh', roh, 'message/rfc822')
      const anhaenge: {
        dateiname: string
        mimeTyp: string
        schluessel: string
        sha256: string
        groesse: number
      }[] = []
      for (const a of mail.anhaenge) {
        const ab = await ctx.speicher.ablegen(pf.mandantId, 'anhang', a.inhalt, a.mimeTyp)
        anhaenge.push({ dateiname: a.dateiname, mimeTyp: a.mimeTyp, ...ab })
      }

      await withMandant(ctx.db, pf.mandantId, async (tx) => {
        const id = await legeNachrichtAn(
          tx,
          {
            mandantId: pf.mandantId,
            postfachId: pf.id,
            uidValidity,
            imapUid: uid,
            messageId: mail.messageId,
            inReplyTo: mail.inReplyTo,
            referenzen: mail.referenzen,
            vonAdresse: mail.vonAdresse,
            vonName: mail.vonName,
            an: mail.an,
            betreff: mail.betreff,
            gesendetAm: mail.gesendetAm,
            text: mail.text,
            roh: rohAblage,
            anhaenge,
          },
          WORKER,
        )
        if (id === null) {
          ergebnis.doppelt++
        } else if (belegPostfach) {
          // Beleg-Adresse: Anhänge in den Belegeingang, keine Zuordnung zu einem Mietverhältnis.
          ergebnis.neu++
          ergebnis.belege += await legeBelegeAusNachrichtAn(tx, {
            mandantId: pf.mandantId,
            nachrichtId: id,
            akteur: WORKER,
            heute: heuteBerlin(),
          })
        } else {
          ergebnis.neu++
          const verlauf = await zuordnungImVerlauf(
            tx,
            [mail.inReplyTo, ...mail.referenzen].filter((x): x is string => Boolean(x)),
          )
          const z = bestimmeZuordnung(
            {
              vonAdresse: mail.vonAdresse,
              betreff: mail.betreff,
              datum: mail.gesendetAm ?? new Date().toISOString(),
              verlauf,
            },
            kandidaten,
          )
          if (z) {
            await ordneNachrichtZu(tx, {
              mandantId: pf.mandantId,
              nachrichtId: id,
              ...z,
              akteur: WORKER,
            })
            ergebnis.zugeordnet++
          }
        }
        await setzeAbrufstand(tx, pf.id, { uidValidity, letzteUid: uid })
      })
    }
    await withMandant(ctx.db, pf.mandantId, (tx) => setzeAbrufstand(tx, pf.id, { uidValidity }))
  } catch (e) {
    // Fehlertext ohne Zugangsdaten; IMAP-Server liefern Klartext wie "Authentication failed".
    ergebnis.fehler = e instanceof Error ? e.message.slice(0, 500) : 'Unbekannter Fehler'
    await withMandant(ctx.db, pf.mandantId, (tx) =>
      setzeAbrufstand(tx, pf.id, { fehler: ergebnis.fehler }),
    ).catch(() => {})
  } finally {
    await client.logout().catch(() => client.close())
  }
  log(
    `${pf.bezeichnung}: ${ergebnis.neu} neu, ${ergebnis.zugeordnet} zugeordnet, ` +
      `${ergebnis.belege} Belege, ${ergebnis.doppelt} doppelt` +
      (ergebnis.fehler ? `, Fehler: ${ergebnis.fehler}` : ''),
  )
  return ergebnis
}

/** Ein Durchlauf über alle aktiven Postfächer aller Mandanten, nacheinander. */
export async function rufeAlleAb(ctx: AbrufKontext): Promise<AbrufErgebnis[]> {
  const liste = await aktivePostfaecherAllerMandanten(ctx.db)
  const ergebnisse: AbrufErgebnis[] = []
  for (const p of liste) ergebnisse.push(await rufePostfachAb(ctx, p))
  return ergebnisse
}
