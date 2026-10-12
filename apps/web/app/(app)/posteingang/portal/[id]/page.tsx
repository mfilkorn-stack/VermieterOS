import {
  antwortenZuPortalNachricht,
  ladePortalNachricht,
  ladeZuordnungsKandidaten,
  listePostfaecher,
} from '@vermieteros/db'
import { MessageSquare } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { AntwortSenden } from '@/components/antwort-senden'
import { zeitpunktAnzeige } from '@/lib/format'
import { absenderAdresse, mailEingerichtet } from '@/lib/mail'
import { mietverhaeltnisText } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'

/** Nachricht aus dem Mieterportal (UX-4): lesen und aus der App beantworten. */
export default async function PortalNachrichtSeite({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const zuordnen = await darf({ post: ['zuordnen'] })
  const daten = await mitMandant(async (tx) => {
    const n = await ladePortalNachricht(tx, id)
    if (!n) return null
    return {
      n,
      mv: (await ladeZuordnungsKandidaten(tx)).find(
        (k) => k.mietverhaeltnisId === n.mietverhaeltnisId,
      ),
      antworten: await antwortenZuPortalNachricht(tx, id),
      // Rückantworten des Mieters sollen im Vermietungs-Postfach landen
      postfach: (await listePostfaecher(tx)).find(
        (x) => x.aktiv && x.zweck === 'post' && x.benutzer.includes('@'),
      ),
    }
  })
  if (!daten) notFound()
  const { n, mv, antworten, postfach } = daten

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/posteingang">Posteingang</Link>
        <span aria-hidden>/</span>
        <span>Nachricht aus dem Mieterportal</span>
      </nav>
      <div className="seitenkopf">
        <h1 data-testid="nachricht-betreff">{n.betreff}</h1>
      </div>
      <div className="raster-2">
        <div>
          <dl className="karte kopfdaten">
            <dt>Von</dt>
            <dd>
              <MessageSquare size={14} aria-hidden /> Mieterportal, {n.email}
            </dd>
            <dt>Mietverhältnis</dt>
            <dd>
              {mv ? (
                <Link href={`/mietverhaeltnisse/${mv.mietverhaeltnisId}`}>
                  {mietverhaeltnisText(mv)}
                </Link>
              ) : (
                '–'
              )}
            </dd>
            <dt>Eingegangen</dt>
            <dd>{zeitpunktAnzeige(n.erstelltAm)}</dd>
          </dl>
          <div className="karte">
            <h2>Text</h2>
            <pre className="mailtext" data-testid="nachricht-text">
              {n.text}
            </pre>
          </div>
        </div>
        <div>
          <AntwortSenden
            portalNachrichtId={n.id}
            an={n.email}
            betreff={n.betreff}
            entwurf={null}
            gesendet={antworten}
            darf={zuordnen}
            moeglich={mailEingerichtet()}
            absender={absenderAdresse()}
            postfachAdresse={postfach?.benutzer ?? null}
          />
          <p className="leise">
            Die Antwort geht per Mail an die Portal-Adresse und erscheint im Portal unter „Ihre
            Nachrichten“.
          </p>
        </div>
      </div>
    </>
  )
}
