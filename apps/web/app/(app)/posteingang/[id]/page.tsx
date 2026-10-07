import { ladeNachricht, ladeZuordnungsKandidaten } from '@vermieteros/db'
import { CircleDot, Download, FileText, Link2, Mail } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Status } from '@/components/status'
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
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/posteingang">Posteingang</Link>
        <span aria-hidden>/</span>
        <span>Nachricht</span>
      </nav>
      <div className="seitenkopf">
        <h1 data-testid="nachricht-betreff">{n.betreff || '(ohne Betreff)'}</h1>
      </div>
      <div className="raster-2">
        <div>
          <dl className="karte kopfdaten">
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
              <p className="meta">
                <Status ton="gruen" icon={Link2}>
                  Zugeordnet
                </Status>
                <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>
                  {mietverhaeltnisText(mv)}
                </Link>
                <span>({ZUORDNUNG_TEXT[aktuell.art]})</span>
              </p>
            ) : (
              <p className="meta">
                <Status ton="gelb" icon={CircleDot}>
                  Offen
                </Status>
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
                    const k = z.mietverhaeltnisId
                      ? kandidatNach.get(z.mietverhaeltnisId)
                      : undefined
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
        </div>
        <div>
          <div className="karte">
            <h2>Text</h2>
            <pre className="mailtext" data-testid="nachricht-text">
              {n.text || '(kein Textteil; die vollständige Mail steht in der .eml)'}
            </pre>
          </div>

          <div className="karte">
            <h2>Dateien</h2>
            <ul className="dateien" data-testid="anhaenge">
              {n.anhaenge.map((a) => (
                <li key={a.id} className="datei">
                  <FileText size={20} strokeWidth={1.75} aria-hidden />
                  <span className="text">
                    <a href={`/api/anhang/${a.id}`} download>
                      {a.dateiname}
                    </a>
                    <span className="pruefsumme">
                      {groesseText(a.groesse)} · SHA-256 {a.sha256.slice(0, 12)}…
                    </span>
                  </span>
                  <Download size={16} color="var(--dezent)" aria-hidden />
                </li>
              ))}
              <li className="datei">
                <Mail size={20} strokeWidth={1.75} aria-hidden />
                <span className="text">
                  <a href={`/api/nachricht/${n.id}/roh`} download data-testid="rohmail">
                    Vollständige Mail (.eml)
                  </a>
                  <span className="pruefsumme">
                    {groesseText(n.rohGroesse)} · SHA-256 {n.rohSha256.slice(0, 12)}…
                  </span>
                </span>
                <Download size={16} color="var(--dezent)" aria-hidden />
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}
