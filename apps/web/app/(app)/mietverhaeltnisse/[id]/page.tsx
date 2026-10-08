import {
  ladeVerlauf,
  letzteVersion,
  listeMietverhaeltnisse,
  listeDokumente,
  portalZugaengeZuMv,
  type PortalZugang,
  type VerlaufEintrag,
} from '@vermieteros/db'
import { DokumentListe } from '@/components/dokument-liste'
import {
  KeyRound,
  Mail,
  MessageSquare,
  Paperclip,
  Phone,
  PhoneIncoming,
  PhoneOutgoing,
  Reply,
} from 'lucide-react'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { euroAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { anhangText, mietverhaeltnisText, ZUORDNUNG_TEXT } from '@/lib/post-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin, isoZuBerlin } from '@/lib/zeit'
import { portalEinladen, portalSperren, telefonnotizSpeichern } from './aktionen'

type Mieter = { id: string; name: string; email: string | null }

/** Mieterportal: aktive Zugänge, Einladen, Sperren (WP 1.10). */
function PortalKarte({
  mvId,
  zugaenge,
  mieter,
  verwalten,
}: {
  mvId: string
  zugaenge: PortalZugang[]
  mieter: Mieter[]
  verwalten: boolean
}) {
  const aktiv = zugaenge.filter((z) => !z.widerrufenAm)
  const name = new Map(mieter.map((m) => [m.id, m.name]))
  const vorschlag = mieter.find((m) => m.email && !aktiv.some((z) => z.personId === m.id))
  return (
    <div className="karte" data-testid="mv-portal">
      <h2>
        <KeyRound size={16} aria-hidden style={{ verticalAlign: '-2px', marginRight: 6 }} />
        Mieterportal
      </h2>
      {aktiv.length === 0 ? (
        <p className="leise">
          Noch kein Zugang. Mieter sehen dort Vertrag, Notfallnummern und können Mängel melden.
        </p>
      ) : (
        <ul className="liste-schlicht">
          {aktiv.map((z) => (
            <li key={z.id} className="zeile" data-testid="portal-zugang">
              <span>
                {name.get(z.personId) ?? 'Mieter'} · {z.email}
                <span className="leise"> · seit {zeitpunktAnzeige(z.erstelltAm)}</span>
              </span>
              {verwalten ? (
                <Formular aktion={portalSperren} knopf="Sperren" zweit testId="portal-sperren">
                  <input type="hidden" name="mietverhaeltnisId" value={mvId} />
                  <input type="hidden" name="zugangId" value={z.id} />
                </Formular>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {verwalten && mieter.length > 0 ? (
        <>
          <h3>Mieter einladen</h3>
          <Formular aktion={portalEinladen} knopf="Einladung senden" testId="portal-einladen">
            <input type="hidden" name="mietverhaeltnisId" value={mvId} />
            <label>
              Mieter
              <select name="personId" defaultValue={vorschlag?.id ?? mieter[0]!.id}>
                {mieter.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </label>
            <Feld
              label="E-Mail für das Portal"
              name="email"
              type="email"
              defaultValue={vorschlag?.email ?? ''}
              required
            />
          </Formular>
        </>
      ) : null}
    </div>
  )
}

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
  if (e.art === 'antwort') {
    return (
      <li className="karte" data-testid="verlauf-eintrag" data-art="antwort">
        <div className="zeile">
          <Link
            href={
              e.nachrichtId
                ? `/posteingang/${e.nachrichtId}`
                : `/posteingang/portal/${e.portalNachrichtId}`
            }
          >
            <strong>{e.betreff}</strong>
          </Link>
          <span className="leise">{zeitpunktAnzeige(e.zeitpunkt)}</span>
        </div>
        <p className="meta">
          <span>
            <Reply size={14} aria-hidden />
            Antwort an {e.an.join(', ')}
          </span>
        </p>
        <p className="auszug" style={{ whiteSpace: 'pre-wrap' }}>
          {e.text}
        </p>
      </li>
    )
  }
  if (e.art === 'portal') {
    return (
      <li className="karte" data-testid="verlauf-eintrag" data-art="portal">
        <div className="zeile">
          <strong>{e.betreff}</strong>
          <span className="leise">{zeitpunktAnzeige(e.zeitpunkt)}</span>
        </div>
        <p className="meta">
          <span>
            <MessageSquare size={14} aria-hidden />
            Mieterportal, {e.von}
          </span>
          <Link href={`/posteingang/portal/${e.id}`}>Antworten</Link>
        </p>
        <p className="auszug" style={{ whiteSpace: 'pre-wrap' }}>
          {e.text}
        </p>
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
  // Stammdaten reichen zum Lesen; Verlauf, Notizen und Portal brauchen das Post-Recht.
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const post = await darf({ post: ['lesen'] })
  const notieren = await darf({ post: ['notieren'] })
  const { kopf, verlauf, dokumente, zugaenge, mieter } = await mitMandant(async (tx) => {
    const mv = await letzteVersion(tx, 'mietverhaeltnis', id)
    const mieter: Mieter[] = []
    for (const pid of mv?.mieterIds ?? []) {
      const p = await letzteVersion(tx, 'person', pid)
      if (p)
        mieter.push({
          id: pid,
          name: p.firma || [p.vorname, p.nachname].filter(Boolean).join(' '),
          email: p.email ?? null,
        })
    }
    return {
      kopf: (await listeMietverhaeltnisse(tx, heuteBerlin())).find(
        (k) => k.mietverhaeltnisId === id,
      ),
      verlauf: post ? await ladeVerlauf(tx, id) : [],
      dokumente: await listeDokumente(tx, { mietverhaeltnisId: id }),
      zugaenge: await portalZugaengeZuMv(tx, id),
      mieter,
    }
  })
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  if (!kopf) notFound()

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/">Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${kopf.objektId}`}>{kopf.objekt}</Link>
        <span aria-hidden>/</span>
        {schreiben ? (
          <Link href={`/objekte/${kopf.objektId}/einheiten/${kopf.einheitId}/vermietung`}>
            {kopf.einheit}
          </Link>
        ) : (
          <span>{kopf.einheit}</span>
        )}
        <span aria-hidden>/</span>
        <span>Mietverhältnis</span>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1>Mietverhältnis · {kopf.mieterNamen.join(', ') || kopf.einheit}</h1>
          <p className="leise" data-testid="verlauf-kopf">
            {mietverhaeltnisText(kopf)}
            {kopf.mieterEmails.length ? ` · ${kopf.mieterEmails.join(', ')}` : ''}
          </p>
        </div>
        {schreiben ? (
          <Link
            className="knopf zweit"
            href={`/objekte/${kopf.objektId}/einheiten/${kopf.einheitId}/vermietung`}
            data-testid="mv-bearbeiten"
          >
            Mieter und Konditionen bearbeiten
          </Link>
        ) : null}
      </div>
      <nav className="reiter" aria-label="Abschnitte" style={{ marginBottom: 16 }}>
        <a href="#dokumente">Dokumente</a>
        {post ? <a href="#portal">Portal</a> : null}
        {post ? <a href="#verlauf">Verlauf</a> : null}
      </nav>
      <dl className="karte kopfdaten" data-testid="mv-konditionen">
        <dt>Mieter</dt>
        <dd>
          {mieter.length
            ? mieter.map((m) => m.name + (m.email ? ' <' + m.email + '>' : '')).join(', ')
            : '–'}
        </dd>
        <dt>Kaltmiete</dt>
        <dd className="ziffern">
          {kopf.kaltmieteCent != null ? euroAnzeige(kopf.kaltmieteCent) : '–'}
        </dd>
        <dt>Vorauszahlungen</dt>
        <dd className="ziffern">
          {kopf.vorauszahlungCent != null ? euroAnzeige(kopf.vorauszahlungCent) : '–'}
        </dd>
        <dt>Personen im Haushalt</dt>
        <dd>{kopf.personenzahl ?? '–'}</dd>
      </dl>

      <div className="karte" id="dokumente" data-testid="mv-dokumente">
        <div className="zeile">
          <h2>Dokumente</h2>
          {schreiben ? (
            <span className="aktionen">
              <Link
                className="knopf zweit"
                href={`/mietverhaeltnisse/${id}/schreiben`}
                data-testid="mv-schreiben"
              >
                Schreiben erstellen
              </Link>
              <Link
                className="knopf zweit"
                href={`/dokumente/neu?mietverhaeltnis=${id}`}
                data-testid="mv-dokument-neu"
              >
                Dokument hochladen
              </Link>
            </span>
          ) : null}
        </div>
        <DokumentListe dokumente={dokumente} />
      </div>

      {post ? (
        <div id="portal">
          <PortalKarte mvId={id} zugaenge={zugaenge} mieter={mieter} verwalten={schreiben} />
        </div>
      ) : null}

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

      {post && verlauf.length === 0 ? (
        <p className="leise">Noch keine Mails oder Notizen zu diesem Mietverhältnis.</p>
      ) : null}
      <ol className="liste" id="verlauf" data-testid="verlauf">
        {verlauf.map((e) => (
          <Eintrag key={`${e.art}-${e.id}`} e={e} notieren={notieren} mvId={id} />
        ))}
      </ol>
    </>
  )
}
