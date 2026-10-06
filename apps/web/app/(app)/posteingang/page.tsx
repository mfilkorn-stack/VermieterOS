import { ladePosteingang, ladeZuordnungsKandidaten, type ZuordnungsKandidat } from '@vermieteros/db'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { datumAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { nachrichtZuordnen } from './aktionen'

const ART_TEXT = {
  verlauf: 'automatisch, Antwort im selben Verlauf',
  absender: 'automatisch über den Absender',
  absender_betreff: 'automatisch über Absender und Betreff',
  manuell: 'von Hand',
  aufgehoben: 'Zuordnung aufgehoben',
} as const

function kandidatText(k: ZuordnungsKandidat): string {
  const zeit = k.ende
    ? `${datumAnzeige(k.beginn)} bis ${datumAnzeige(k.ende)}`
    : `seit ${datumAnzeige(k.beginn)}`
  return [k.einheit, k.objekt, k.mieterNamen.join(', ') || 'ohne Mieter', zeit].join(' · ')
}

function groesse(bytes: number): string {
  return bytes < 1024
    ? `${bytes} B`
    : bytes < 1_048_576
      ? `${Math.round(bytes / 1024)} KB`
      : `${(bytes / 1_048_576).toFixed(1)} MB`
}

export default async function PosteingangSeite({
  searchParams,
}: {
  searchParams: Promise<{ alle?: string }>
}) {
  if (!(await darf({ post: ['lesen'] }))) redirect('/')
  const alle = (await searchParams).alle === '1'
  const zuordnen = await darf({ post: ['zuordnen'] })
  const postfaecher = await darf({ post: ['postfaecher'] })
  const { eintraege, kandidaten } = await mitMandant(async (tx) => ({
    eintraege: await ladePosteingang(tx, { nurOffen: !alle }),
    kandidaten: await ladeZuordnungsKandidaten(tx),
  }))
  const kandidatNach = new Map(kandidaten.map((k) => [k.mietverhaeltnisId, k]))
  const zurueck = alle ? '/posteingang?alle=1' : '/posteingang'

  return (
    <>
      <h1>Posteingang</h1>
      <p className="leise">
        <Link href="/posteingang" aria-current={alle ? undefined : 'page'}>
          Offen
        </Link>{' '}
        ·{' '}
        <Link href="/posteingang?alle=1" aria-current={alle ? 'page' : undefined}>
          Alle
        </Link>
        {postfaecher ? (
          <>
            {' '}
            · <Link href="/postfaecher">Postfächer einrichten</Link>
          </>
        ) : null}
      </p>
      {eintraege.length === 0 ? (
        <p className="leise" data-testid="posteingang-leer">
          {alle ? 'Noch keine Nachrichten.' : 'Nichts offen. Alle Nachrichten sind zugeordnet.'}
        </p>
      ) : null}
      <ul className="liste" data-testid="posteingang">
        {eintraege.map((n) => {
          const z = n.zuordnung
          const mv = z?.mietverhaeltnisId ? kandidatNach.get(z.mietverhaeltnisId) : undefined
          return (
            <li key={n.id} className="karte" data-testid="nachricht" data-betreff={n.betreff}>
              <div className="zeile">
                <strong>{n.betreff || '(ohne Betreff)'}</strong>
                <span className="leise">{zeitpunktAnzeige(n.gesendetAm ?? n.empfangenAm)}</span>
              </div>
              <p className="leise">
                {n.vonName ? `${n.vonName} <${n.vonAdresse}>` : n.vonAdresse} · {n.postfach}
              </p>
              <p data-testid="zuordnung">
                {mv && z ? (
                  <>
                    <span className="ampel ampel-gruen">Zugeordnet</span> {kandidatText(mv)} (
                    {ART_TEXT[z.art]})
                  </>
                ) : (
                  <span className="ampel ampel-gelb">Offen{z ? ` · ${ART_TEXT[z.art]}` : ''}</span>
                )}
              </p>
              <details>
                <summary>
                  Text{n.anhaenge.length ? ` und ${n.anhaenge.length} Anhang/Anhänge` : ''}
                </summary>
                <pre className="mailtext">{n.text || '(kein Textteil)'}</pre>
                {n.anhaenge.length ? (
                  <ul data-testid="anhaenge">
                    {n.anhaenge.map((a) => (
                      <li key={a.sha256}>
                        {a.dateiname} · {groesse(a.groesse)}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </details>
              {zuordnen ? (
                <details open={!mv}>
                  <summary>{mv ? 'Zuordnung ändern' : 'Zuordnen'}</summary>
                  <Formular aktion={nachrichtZuordnen} knopf="Speichern" testId="zuordnen">
                    <input type="hidden" name="nachrichtId" value={n.id} />
                    <input type="hidden" name="zurueck" value={zurueck} />
                    <label>
                      Mietverhältnis
                      <select name="mietverhaeltnisId" defaultValue={mv?.mietverhaeltnisId ?? ''}>
                        <option value="">{mv ? 'Zuordnung aufheben' : 'Bitte wählen'}</option>
                        {kandidaten.map((k) => (
                          <option key={k.mietverhaeltnisId} value={k.mietverhaeltnisId}>
                            {kandidatText(k)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Notiz zur Zuordnung
                      <input name="begruendung" />
                    </label>
                  </Formular>
                </details>
              ) : null}
            </li>
          )
        })}
      </ul>
    </>
  )
}
