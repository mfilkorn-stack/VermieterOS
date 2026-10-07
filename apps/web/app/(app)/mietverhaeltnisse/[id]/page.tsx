import { ladeVerlauf, ladeZuordnungsKandidaten, type VerlaufEintrag } from '@vermieteros/db'
import { Mail, Paperclip, Phone, PhoneIncoming, PhoneOutgoing } from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { zeitpunktAnzeige } from '@/lib/format'
import { anhangText, mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { isoZuBerlin } from '@/lib/zeit'
import { telefonnotizSpeichern } from './aktionen'

function NotizFelder({
  mietverhaeltnisId,
  vorlage,
  ersetztId,
}: {
  mietverhaeltnisId: string
  vorlage: {
    zeitpunkt: string
    richtung: string
    gespraechspartner: string
    betreff: string
    inhalt: string
  }
  ersetztId?: string
}) {
  return (
    <>
      <input type="hidden" name="mietverhaeltnisId" value={mietverhaeltnisId} />
      {ersetztId ? <input type="hidden" name="ersetztId" value={ersetztId} /> : null}
      <div className="zeile">
        <Feld
          label="Zeitpunkt"
          name="zeitpunkt"
          type="datetime-local"
          defaultValue={vorlage.zeitpunkt}
          required
        />
        <label>
          Richtung
          <select name="richtung" defaultValue={vorlage.richtung}>
            <option value="eingehend">Anruf erhalten</option>
            <option value="ausgehend">Selbst angerufen</option>
          </select>
        </label>
      </div>
      <Feld
        label="Gesprächspartner"
        name="gespraechspartner"
        defaultValue={vorlage.gespraechspartner}
        required
      />
      <Feld label="Betreff" name="betreff" defaultValue={vorlage.betreff} required />
      <label>
        Inhalt und Absprachen
        <textarea name="inhalt" rows={5} defaultValue={vorlage.inhalt} required />
      </label>
    </>
  )
}

function Eintrag({ e, notieren, mvId }: { e: VerlaufEintrag; notieren: boolean; mvId: string }) {
  if (e.art === 'nachricht') {
    return (
      <li className="karte" data-testid="verlauf-eintrag" data-art="nachricht">
        <div className="zeile">
          <Link href={`/posteingang/${e.id}`}>
            <strong>{e.betreff || '(ohne Betreff)'}</strong>
          </Link>
          <span className="leise">{zeitpunktAnzeige(e.zeitpunkt)}</span>
        </div>
        <p className="meta">
          <span>
            <Mail size={14} aria-hidden />
            Mail von {e.von}
          </span>
          {e.anhaenge ? (
            <span>
              <Paperclip size={14} aria-hidden />
              {anhangText(e.anhaenge)}
            </span>
          ) : null}
          <span>{ZUORDNUNG_TEXT[e.zuordnung]}</span>
        </p>
        <p className="auszug">{e.auszug}</p>
      </li>
    )
  }
  return (
    <li className="karte verlauf-notiz" data-testid="verlauf-eintrag" data-art="telefonnotiz">
      <div className="zeile">
        <strong>{e.betreff}</strong>
        <span className="leise">{zeitpunktAnzeige(e.zeitpunkt)}</span>
      </div>
      <p className="meta">
        <span>
          {e.richtung === 'eingehend' ? (
            <PhoneIncoming size={14} aria-hidden />
          ) : (
            <PhoneOutgoing size={14} aria-hidden />
          )}
          Telefonat ·{' '}
          {e.richtung === 'eingehend'
            ? `Anruf von ${e.gespraechspartner}`
            : `Anruf bei ${e.gespraechspartner}`}
        </span>
        {e.korrigiert ? <span>korrigiert</span> : null}
      </p>
      <p className="mailtext">{e.inhalt}</p>
      {notieren ? (
        <details>
          <summary>Korrigieren</summary>
          <p className="leise">
            Die Korrektur ersetzt diese Notiz; die alte Fassung bleibt im Hintergrund erhalten.
          </p>
          <Formular
            aktion={telefonnotizSpeichern}
            knopf="Korrektur speichern"
            testId="notiz-korrigieren"
          >
            <NotizFelder
              mietverhaeltnisId={mvId}
              ersetztId={e.id}
              vorlage={{
                zeitpunkt: isoZuBerlin(e.zeitpunkt),
                richtung: e.richtung,
                gespraechspartner: e.gespraechspartner,
                betreff: e.betreff,
                inhalt: e.inhalt,
              }}
            />
          </Formular>
        </details>
      ) : null}
    </li>
  )
}

export default async function VerlaufSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const notieren = await darf({ post: ['notieren'] })
  const { kopf, verlauf } = await mitMandant(async (tx) => ({
    kopf: (await ladeZuordnungsKandidaten(tx)).find((k) => k.mietverhaeltnisId === id),
    verlauf: await ladeVerlauf(tx, id),
  }))
  if (!kopf) notFound()

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/">Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${kopf.objektId}`}>{kopf.objekt}</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${kopf.objektId}/einheiten/${kopf.einheitId}/vermietung`}>
          Vermietung
        </Link>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1>Verlauf · {kopf.mieterNamen.join(', ') || kopf.einheit}</h1>
          <p className="leise" data-testid="verlauf-kopf">
            {mietverhaeltnisText(kopf)}
            {kopf.mieterEmails.length ? ` · ${kopf.mieterEmails.join(', ')}` : ''}
          </p>
        </div>
      </div>

      {notieren ? (
        <details className="karte" open={verlauf.length === 0}>
          <summary>
            <Phone size={16} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
            Telefonnotiz erfassen
          </summary>
          <Formular aktion={telefonnotizSpeichern} knopf="Notiz speichern" testId="telefonnotiz">
            <NotizFelder
              mietverhaeltnisId={id}
              vorlage={{
                zeitpunkt: isoZuBerlin(new Date().toISOString()),
                richtung: 'eingehend',
                gespraechspartner: kopf.mieterNamen.join(', '),
                betreff: '',
                inhalt: '',
              }}
            />
          </Formular>
        </details>
      ) : null}

      {verlauf.length === 0 ? (
        <p className="leise">Noch keine Mails oder Notizen zu diesem Mietverhältnis.</p>
      ) : null}
      <ol className="liste" data-testid="verlauf">
        {verlauf.map((e) => (
          <Eintrag key={`${e.art}-${e.id}`} e={e} notieren={notieren} mvId={id} />
        ))}
      </ol>
    </>
  )
}
