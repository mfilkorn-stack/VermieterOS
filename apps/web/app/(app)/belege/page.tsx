import { listeBelege, objekteFuerBeleg, type BelegZeile } from '@vermieteros/db'
import { FileText, Inbox, Mail, Sparkles, Wrench } from 'lucide-react'
import Link from 'next/link'
import { BelegImport } from '@/components/beleg-import'
import { Status } from '@/components/status'
import { datumAnzeige, euroAnzeige } from '@/lib/format'
import { kiEingerichtet } from '@/lib/ki'
import { darf, mitMandant } from '@/lib/sitzung'
import { belegAuslesenDirekt, belegHochladen } from './aktionen'
import { KiHinweis } from '@/components/ki-hinweis'

function Herkunft({ b }: { b: BelegZeile }) {
  if (b.ticketId)
    return (
      <span>
        <Wrench size={14} aria-hidden /> Ticket
      </span>
    )
  if (b.anhangId)
    return (
      <span>
        <Mail size={14} aria-hidden /> per Mail
      </span>
    )
  return (
    <span>
      <FileText size={14} aria-hidden /> hochgeladen
    </span>
  )
}

export default async function BelegeSeite({
  searchParams,
}: {
  searchParams: Promise<{ gebucht?: string }>
}) {
  const fertig = (await searchParams).gebucht === '1'
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const ki = kiEingerichtet()
  const { offen, gebucht, objekte } = await mitMandant(async (tx) => ({
    offen: await listeBelege(tx, { status: 'offen' }),
    gebucht: await listeBelege(tx, { status: 'gebucht', limit: 15 }),
    objekte: await objekteFuerBeleg(tx),
  }))

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Belegeingang</h1>
          <p className="leise">
            Rechnungen und Bescheide: hochladen, an die Beleg-Adresse weiterleiten oder am Ticket
            ablegen. Die KI liest aus, du bestätigst, dann steht der Beleg im Journal.
          </p>
        </div>
        <Link className="knopf zweit" href="/journal">
          Journal
        </Link>
      </div>
      {fertig && offen.length === 0 ? (
        <p className="karte" data-testid="belege-fertig">
          Alles gebucht. Keine offenen Belege mehr.
        </p>
      ) : null}
      <div className="raster-2">
        <section>
          <h2>
            <Inbox size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Offen ({offen.length})
          </h2>
          {offen.length === 0 ? (
            <p className="leise" data-testid="belege-leer">
              Keine offenen Belege.
            </p>
          ) : (
            <ul className="liste" data-testid="belege-offen">
              {offen.map((b) => (
                <li key={b.id} className="karte nachricht" data-testid="beleg" data-titel={b.titel}>
                  <div className="nachricht-kopf">
                    <Link href={`/belege/${b.id}`}>{b.titel}</Link>
                    <span className="meta">
                      {b.kiStatus === 'offen' ? (
                        <Status ton="neutral">
                          <Sparkles size={13} aria-hidden /> ausgelesen
                        </Status>
                      ) : null}
                    </span>
                  </div>
                  <p className="meta">
                    <Herkunft b={b} />
                    <span>{datumAnzeige(b.erstelltAm.slice(0, 10))}</span>
                    <span className="leise">{b.dateiname}</span>
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section>
          {schreiben ? (
            <div className="karte">
              <h2>Belege hochladen</h2>
              <p className="leise">
                Mehrere Dateien auf einmal, z. B. alle Rechnungen seit Januar. Doppelte Dateien
                erkennt die Software an der Prüfsumme.
              </p>
              <BelegImport
                hochladen={belegHochladen}
                auslesen={belegAuslesenDirekt}
                ki={ki}
                objekte={objekte.map((o) => ({ id: o.id, bezeichnung: o.bezeichnung }))}
              />
              {ki ? <KiHinweis was="Jeder hochgeladene Beleg" /> : null}
            </div>
          ) : null}
          <div className="karte">
            <h2>Zuletzt gebucht</h2>
            {gebucht.length === 0 ? (
              <p className="leise">Noch nichts gebucht.</p>
            ) : (
              <table className="vergleich" data-testid="belege-gebucht">
                <tbody>
                  {gebucht.map((b) => (
                    <tr key={b.id}>
                      <td className="mono">
                        <Link href={`/journal/${b.buchung!.id}`}>{b.buchung!.belegnummer}</Link>
                      </td>
                      <td>
                        <Link href={`/belege/${b.id}`}>{b.titel}</Link>
                      </td>
                      <td className="betrag">{euroAnzeige(b.buchung!.bruttoCent)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </>
  )
}
