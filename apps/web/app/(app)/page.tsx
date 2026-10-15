import { schema } from '@vermieteros/db'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { BereichReiter } from '@/components/bereich-reiter'
import { NavIcon } from '@/components/navigation'
import { ObjektListe } from '@/components/objekt-liste'
import { Status } from '@/components/status'
import { DRINGEND, ladeBkFristen, STUFE_TEXT, STUFE_TON } from '@/lib/bk-fristen'
import { datumAnzeige } from '@/lib/format'
import { ladeZaehler, zuErledigen } from '@/lib/navigation'
import { ladeObjektKacheln } from '@/lib/objekte'
import { ROLLEN_TEXT, roles } from '@/lib/rechte'
import { darf, mitMandant } from '@/lib/sitzung'

/** Übersicht: was wartet, welche Fristen laufen, dann Häuser und Wohnungen mit Ampeln. */
export default async function Startseite() {
  const { mandant, rolle, objekte, fristen, zaehler } = await mitMandant(async (tx, k) => {
    const [m] = await tx.select().from(schema.mandanten)
    const post = roles[k.rolle].authorize({ post: ['lesen'] }).success
    return {
      mandant: m,
      rolle: k.rolle,
      objekte: await ladeObjektKacheln(tx),
      fristen: (await ladeBkFristen(tx)).filter((f) => DRINGEND.has(f.stufe)),
      zaehler: await ladeZaehler(tx, post),
    }
  })
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const kacheln = zuErledigen(zaehler, rolle)

  return (
    <>
      <BereichReiter bereich="bestand" aktiv="/" />
      <div className="seitenkopf">
        <div>
          <h1 data-testid="mandant-name">{mandant?.name}</h1>
          <p className="leise">Deine Rolle: {ROLLEN_TEXT[rolle]}</p>
        </div>
        {schreiben ? (
          <div className="aktionen">
            <Link className="knopf" href="/objekte/neu?art=haus" data-testid="objekt-neu">
              <Plus size={18} aria-hidden />
              Haus anlegen
            </Link>
            <Link className="knopf" href="/objekte/neu?art=etw" data-testid="etw-neu">
              <Plus size={18} aria-hidden />
              Eigentumswohnung anlegen
            </Link>
          </div>
        ) : null}
      </div>

      {kacheln.length ? (
        <>
          <h2>Zu erledigen</h2>
          <ul className="kacheln" data-testid="zu-erledigen">
            {kacheln.map((e) => (
              <li key={e.href}>
                <Link href={e.href} className="kachel">
                  <NavIcon name={e.icon} size={20} />
                  <strong className="ziffern">{e.zaehler!.n}</strong>
                  <span>
                    {e.label} · {e.zaehler!.text}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="leise" data-testid="nichts-offen">
          Nichts offen: keine neuen Mails, Tickets, Belege oder Fristen.
        </p>
      )}

      {fristen.length ? (
        <div className="karte" data-testid="start-fristen">
          <h2>Betriebskosten: Fristen</h2>
          <ul className="liste-schlicht">
            {fristen.map((f) => (
              <li key={f.einheitId + f.jahr} className="zeile">
                <Link
                  href={
                    f.abrechnungId
                      ? `/betriebskosten/${f.abrechnungId}`
                      : `/objekte/${f.objektId}/einheiten/${f.einheitId}/betriebskosten?jahr=${f.jahr}`
                  }
                >
                  {f.jahr} · {f.objekt} · {f.einheit}
                  <span className="leise"> · Frist {datumAnzeige(f.fristBis)}</span>
                </Link>
                <Status ton={STUFE_TON[f.stufe]}>{STUFE_TEXT[f.stufe]}</Status>
              </li>
            ))}
          </ul>
          <p className="leise">
            <Link href="/betriebskosten">Alle Abrechnungen</Link>
          </p>
        </div>
      ) : null}

      {objekte.length === 0 && schreiben ? (
        <div className="karte" data-testid="erste-schritte">
          <h2>Erste Schritte</h2>
          <ol className="schritte">
            <li>
              <Link href="/eigentuemer">Eigentümer und Anteile prüfen</Link>
              <span className="leise"> · für die Steuer je Person</span>
            </li>
            <li>
              <Link href="/objekte/neu?art=haus">Haus</Link> oder{' '}
              <Link href="/objekte/neu?art=etw">Eigentumswohnung</Link> anlegen
              <span className="leise"> · danach Einheiten und Mieter in der Akte</span>
            </li>
            <li>
              <Link href="/postfaecher">Postfach verbinden</Link>
              <span className="leise"> · Mails landen automatisch beim Mietverhältnis</span>
            </li>
          </ol>
        </div>
      ) : null}
      <h2>Häuser und Wohnungen</h2>
      <ObjektListe objekte={objekte} schreiben={schreiben} />
    </>
  )
}
