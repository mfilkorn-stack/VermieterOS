import {
  geltendeKiVorschlaege,
  ladePosteingang,
  ladeZuordnungsKandidaten,
  offeneNachrichten,
} from '@vermieteros/db'
import { CircleDot, Link2, Mail, Paperclip, Search, Settings } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SortierBadges, sortierungAus } from '@/components/ki-sortierung'
import { Status } from '@/components/status'
import { ZuordnenFormular } from '@/components/zuordnen-formular'
import { zeitpunktAnzeige } from '@/lib/format'
import { anhangText, mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function PosteingangSeite({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string; q?: string }>
}) {
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const sp = await searchParams
  const suche = sp.q?.trim() ?? ''
  // Mit Suchbegriff immer über alle Nachrichten suchen.
  const alle = sp.alle === '1' || suche !== ''
  const zuordnen = await darf({ post: ['zuordnen'] })
  const postfaecher = await darf({ post: ['postfaecher'] })
  const { eintraege, kandidaten, offen, sortierungen } = await mitMandant(async (tx) => {
    const eintraege = await ladePosteingang(tx, { nurOffen: !alle, suche })
    return {
      eintraege,
      kandidaten: await ladeZuordnungsKandidaten(tx),
      offen: await offeneNachrichten(tx),
      sortierungen: await geltendeKiVorschlaege(
        tx,
        'sortierung',
        eintraege.map((n) => n.id),
      ),
    }
  })
  const kandidatNach = new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k]))
  const zurueck = suche
    ? `/posteingang?q=${encodeURIComponent(suche)}`
    : alle
      ? '/posteingang?alle=1'
      : '/posteingang'

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Posteingang</h1>
          <p className="leise">
            {offen === 0
              ? 'Alles zugeordnet.'
              : `${offen} ${offen === 1 ? 'Nachricht wartet' : 'Nachrichten warten'} auf Zuordnung.`}
          </p>
        </div>
        {postfaecher ? (
          <Link className="knopf zweit" href="/postfaecher">
            <Settings size={16} aria-hidden />
            Postfächer einrichten
          </Link>
        ) : null}
      </div>
      <div className="zeile" style={{ marginBottom: 16 }}>
        <nav className="reiter" aria-label="Filter">
          <Link href="/posteingang" aria-current={alle ? undefined : 'page'}>
            Offen{offen > 0 ? <span className="zahl">{offen}</span> : null}
          </Link>
          <Link href="/posteingang?alle=1" aria-current={alle && !suche ? 'page' : undefined}>
            Alle
          </Link>
        </nav>
        <form action="/posteingang" role="search" className="suche">
          <label>
            <span className="sr-only">Suche</span>
            <span className="suchfeld">
              <Search size={16} aria-hidden />
              <input
                name="q"
                type="search"
                defaultValue={suche}
                placeholder="Betreff, Absender, Text"
              />
            </span>
          </label>
        </form>
      </div>
      {eintraege.length === 0 ? (
        <p className="leise" data-testid="posteingang-leer">
          {suche
            ? `Keine Nachricht zu „${suche}“.`
            : alle
              ? 'Noch keine Nachrichten.'
              : 'Nichts offen. Alle Nachrichten sind zugeordnet.'}
        </p>
      ) : null}
      <ul className="liste" data-testid="posteingang">
        {eintraege.map((n) => {
          const z = n.zuordnung
          const mv = z?.mietverhaeltnisId ? kandidatNach.get(z.mietverhaeltnisId) : undefined
          return (
            <li
              key={n.id}
              className="karte nachricht"
              data-testid="nachricht"
              data-betreff={n.betreff}
            >
              <div className="nachricht-kopf">
                <Link href={`/posteingang/${n.id}`}>{n.betreff || '(ohne Betreff)'}</Link>
                <span className="leise ziffern" style={{ whiteSpace: 'nowrap' }}>
                  {zeitpunktAnzeige(n.gesendetAm ?? n.empfangenAm)}
                </span>
              </div>
              <p className="meta">
                <span>
                  <Mail size={14} aria-hidden />
                  {n.vonName ? `${n.vonName} <${n.vonAdresse}>` : n.vonAdresse}
                </span>
                <span>{n.postfach}</span>
                {n.anhaenge.length ? (
                  <span>
                    <Paperclip size={14} aria-hidden />
                    {anhangText(n.anhaenge.length)}
                  </span>
                ) : null}
              </p>
              {sortierungen.has(n.id) ? (
                <SortierBadges s={sortierungAus(sortierungen.get(n.id))!} />
              ) : null}
              <p className="meta" data-testid="zuordnung">
                {mv && z ? (
                  <>
                    <Status ton="gruen" icon={Link2}>
                      Zugeordnet
                    </Status>
                    <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>
                      {mietverhaeltnisText(mv)}
                    </Link>
                    <span>({ZUORDNUNG_TEXT[z.art]})</span>
                  </>
                ) : (
                  <Status ton="gelb" icon={CircleDot}>
                    Offen{z ? ` · ${ZUORDNUNG_TEXT[z.art]}` : ''}
                  </Status>
                )}
              </p>
              {zuordnen && !mv ? (
                <details open>
                  <summary>Zuordnen</summary>
                  <ZuordnenFormular
                    nachrichtId={n.id}
                    aktuell={null}
                    kandidaten={kandidaten}
                    zurueck={zurueck}
                  />
                </details>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
