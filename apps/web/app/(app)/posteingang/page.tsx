import { ladePosteingang, ladeZuordnungsKandidaten } from '@vermieteros/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
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
  const { eintraege, kandidaten } = await mitMandant(async (tx) => ({
    eintraege: await ladePosteingang(tx, { nurOffen: !alle, suche }),
    kandidaten: await ladeZuordnungsKandidaten(tx),
  }))
  const kandidatNach = new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k]))
  const zurueck = suche
    ? `/posteingang?q=${encodeURIComponent(suche)}`
    : alle
      ? '/posteingang?alle=1'
      : '/posteingang'

  return (
    <>
      <h1>Posteingang</h1>
      <div className="zeile">
        <p className="leise">
          <Link href="/posteingang" aria-current={alle ? undefined : 'page'}>
            Offen
          </Link>{' '}
          ·{' '}
          <Link href="/posteingang?alle=1" aria-current={alle && !suche ? 'page' : undefined}>
            Alle
          </Link>
          {postfaecher ? (
            <>
              {' '}
              · <Link href="/postfaecher">Postfächer einrichten</Link>
            </>
          ) : null}
        </p>
        <form action="/posteingang" role="search" className="suche">
          <label>
            Suche
            <input
              name="q"
              type="search"
              defaultValue={suche}
              placeholder="Betreff, Absender, Text"
            />
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
            <li key={n.id} className="karte" data-testid="nachricht" data-betreff={n.betreff}>
              <div className="zeile">
                <Link href={`/posteingang/${n.id}`}>
                  <strong>{n.betreff || '(ohne Betreff)'}</strong>
                </Link>
                <span className="leise">{zeitpunktAnzeige(n.gesendetAm ?? n.empfangenAm)}</span>
              </div>
              <p className="leise">
                {n.vonName ? `${n.vonName} <${n.vonAdresse}>` : n.vonAdresse} · {n.postfach}
                {n.anhaenge.length ? ` · ${anhangText(n.anhaenge.length)}` : ''}
              </p>
              <p data-testid="zuordnung">
                {mv && z ? (
                  <>
                    <span className="ampel ampel-gruen">Zugeordnet</span>{' '}
                    <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>
                      {mietverhaeltnisText(mv)}
                    </Link>{' '}
                    ({ZUORDNUNG_TEXT[z.art]})
                  </>
                ) : (
                  <span className="ampel ampel-gelb">
                    Offen{z ? ` · ${ZUORDNUNG_TEXT[z.art]}` : ''}
                  </span>
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
