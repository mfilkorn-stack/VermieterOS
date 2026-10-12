import {
  geltendeKiVorschlaege,
  ladePosteingang,
  ladeZuordnungsKandidaten,
  listeHandwerker,
  listePortalNachrichten,
  listePostfaecher,
  offeneNachrichten,
} from '@vermieteros/db'
import { Mail, MessageSquare, Paperclip, Search, Settings } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { SortierBadges, sortierungAus } from '@/components/ki-sortierung'
import { ZuordnenFormular } from '@/components/zuordnen-formular'
import { ZuordnungAnzeige } from '@/components/zuordnung-anzeige'
import { zeitpunktAnzeige } from '@/lib/format'
import { objektliste } from '@/lib/objekte'
import { anhangText } from '@/lib/post-text'
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
  const { eintraege, kandidaten, objekte, handwerker, hatPostfach, portal, offen, sortierungen } =
    await mitMandant(async (tx) => {
      const eintraege = await ladePosteingang(tx, { nurOffen: !alle, suche })
      return {
        eintraege,
        kandidaten: await ladeZuordnungsKandidaten(tx),
        objekte: await objektliste(tx),
        handwerker: await listeHandwerker(tx),
        hatPostfach: (await listePostfaecher(tx)).length > 0,
        portal: await listePortalNachrichten(tx, { nurOffen: true, limit: 10 }),
        offen: await offeneNachrichten(tx),
        sortierungen: await geltendeKiVorschlaege(
          tx,
          'sortierung',
          eintraege.map((n) => n.id),
        ),
      }
    })
  const namen = {
    kandidaten: new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k])),
    objekte: new Map(objekte.map((o) => [o.id, o.bezeichnung])),
    handwerker: new Map(handwerker.map((h) => [h.id, h.firma])),
  }
  const ziele = { kandidaten, objekte, handwerker }
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
            {!hatPostfach
              ? 'Noch kein Postfach verbunden.'
              : offen === 0
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
            Nicht zugeordnet{offen > 0 ? <span className="zahl">{offen}</span> : null}
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
      {portal.length && !alle && !suche ? (
        <div className="karte" data-testid="portal-nachrichten">
          <h2>
            <MessageSquare
              size={18}
              aria-hidden
              style={{ verticalAlign: '-3px', marginRight: 6 }}
            />
            Aus dem Mieterportal, noch unbeantwortet
          </h2>
          <ul className="liste-schlicht">
            {portal.map((p) => {
              const k = namen.kandidaten.get(p.mietverhaeltnisId)
              return (
                <li key={p.id} className="zeile">
                  <span>
                    <Link href={`/posteingang/portal/${p.id}`}>{p.betreff}</Link>
                    <span className="leise">
                      {' '}
                      · {k ? k.mieterNamen.join(', ') || k.einheit : p.email}
                    </span>
                  </span>
                  <span className="leise ziffern">{zeitpunktAnzeige(p.erstelltAm)}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
      {eintraege.length === 0 ? (
        <p className="leise" data-testid="posteingang-leer">
          {!hatPostfach ? (
            <>
              Noch kein Postfach verbunden.{' '}
              {postfaecher ? (
                <Link href="/postfaecher">Postfach einrichten</Link>
              ) : (
                'Ein Eigentümer richtet das Postfach ein.'
              )}
            </>
          ) : suche ? (
            `Keine Nachricht zu „${suche}“.`
          ) : alle ? (
            'Noch keine Nachrichten.'
          ) : (
            'Nichts offen. Alle Nachrichten sind zugeordnet.'
          )}
        </p>
      ) : null}
      <ul className="liste" data-testid="posteingang">
        {eintraege.map((n) => {
          const z = n.zuordnung
          const offenGeblieben =
            !z?.mietverhaeltnisId && !z?.objektId && !z?.handwerkerId && z?.art !== 'erledigt'
          const detail =
            zurueck === '/posteingang'
              ? `/posteingang/${n.id}`
              : `/posteingang/${n.id}?zurueck=${encodeURIComponent(zurueck)}`
          return (
            <li
              key={n.id}
              className="karte nachricht"
              data-testid="nachricht"
              data-betreff={n.betreff}
            >
              <div className="nachricht-kopf">
                <Link href={detail}>{n.betreff || '(ohne Betreff)'}</Link>
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
                <ZuordnungAnzeige z={z} namen={namen} />
              </p>
              {zuordnen && offenGeblieben ? (
                <ZuordnenFormular nachrichtId={n.id} aktuell="" ziele={ziele} zurueck={zurueck} />
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
