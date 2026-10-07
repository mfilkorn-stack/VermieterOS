import { ladeNachricht, ladeZuordnungsKandidaten } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ZuordnenFormular } from '@/components/zuordnen-formular'
import { zeitpunktAnzeige } from '@/lib/format'
import { groesseText, mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function NachrichtSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const zuordnen = await darf({ post: ['zuordnen'] })
  const { n, kandidaten } = await mitMandant(async (tx) => ({
    n: await ladeNachricht(tx, id),
    kandidaten: await ladeZuordnungsKandidaten(tx),
  }))
  if (!n) notFound()
  const kandidatNach = new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k]))
  const aktuell = n.zuordnungen.at(-1)
  const mv = aktuell?.mietverhaeltnisId ? kandidatNach.get(aktuell.mietverhaeltnisId) : undefined

  return (
    <>
      <p className="leise">
        <Link href="/posteingang">Posteingang</Link>
      </p>
      <h1 data-testid="nachricht-betreff">{n.betreff || '(ohne Betreff)'}</h1>
      <dl className="kopfdaten">
        <dt>Von</dt>
        <dd>{n.vonName ? `${n.vonName} <${n.vonAdresse}>` : n.vonAdresse}</dd>
        <dt>An</dt>
        <dd>{n.an.join(', ') || '–'}</dd>
        <dt>Gesendet</dt>
        <dd>{zeitpunktAnzeige(n.gesendetAm)}</dd>
        <dt>Eingegangen</dt>
        <dd>
          {zeitpunktAnzeige(n.empfangenAm)} · Postfach {n.postfach}
        </dd>
      </dl>

      <div className="karte" data-testid="zuordnung">
        <h2>Zuordnung</h2>
        {mv && aktuell ? (
          <p>
            <span className="ampel ampel-gruen">Zugeordnet</span>{' '}
            <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>
              {mietverhaeltnisText(mv)}
            </Link>{' '}
            ({ZUORDNUNG_TEXT[aktuell.art]})
          </p>
        ) : (
          <p>
            <span className="ampel ampel-gelb">Offen</span>
          </p>
        )}
        {zuordnen ? (
          <details open={!mv}>
            <summary>{mv ? 'Zuordnung ändern' : 'Zuordnen'}</summary>
            <ZuordnenFormular
              nachrichtId={n.id}
              aktuell={mv?.mietverhaeltnisId ?? null}
              kandidaten={kandidaten}
              zurueck={`/posteingang/${n.id}`}
            />
          </details>
        ) : null}
        {n.zuordnungen.length > 0 ? (
          <details>
            <summary>Verlauf der Zuordnung</summary>
            <ol className="leise" data-testid="zuordnungsverlauf">
              {n.zuordnungen.map((z, i) => {
                const k = z.mietverhaeltnisId ? kandidatNach.get(z.mietverhaeltnisId) : undefined
                return (
                  <li key={i}>
                    {zeitpunktAnzeige(z.erfasstAm)}: {k ? mietverhaeltnisText(k) : 'keins'} ·{' '}
                    {ZUORDNUNG_TEXT[z.art]}
                    {z.akteurArt === 'system' ? '' : ' · Nutzer'}
                    {z.begruendung ? ` · „${z.begruendung}“` : ''}
                  </li>
                )
              })}
            </ol>
          </details>
        ) : null}
      </div>

      <div className="karte">
        <h2>Text</h2>
        <pre className="mailtext" data-testid="nachricht-text">
          {n.text || '(kein Textteil; die vollständige Mail steht in der .eml)'}
        </pre>
      </div>

      <div className="karte">
        <h2>Dateien</h2>
        <ul className="liste" data-testid="anhaenge">
          {n.anhaenge.map((a) => (
            <li key={a.id}>
              <a href={`/api/anhang/${a.id}`} download>
                {a.dateiname}
              </a>{' '}
              <span className="leise">
                · {groesseText(a.groesse)} · SHA-256 {a.sha256.slice(0, 12)}…
              </span>
            </li>
          ))}
          <li>
            <a href={`/api/nachricht/${n.id}/roh`} download data-testid="rohmail">
              Vollständige Mail (.eml)
            </a>{' '}
            <span className="leise">
              · {groesseText(n.rohGroesse)} · SHA-256 {n.rohSha256.slice(0, 12)}…
            </span>
          </li>
        </ul>
      </div>
    </>
  )
}
