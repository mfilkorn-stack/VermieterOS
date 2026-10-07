import type { SteuerZeile } from '@vermieteros/rechenkern'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { Status } from '@/components/status'
import { datumAnzeige, euroAnzeige, euroText } from '@/lib/format'
import { STEUERKATEGORIE_TEXT } from '@/lib/journal-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { ladeSteuerSeite, STATUS_TEXT, WEITERE_ZEILEN, type SteuerSeite } from '@/lib/steuer'
import { steuerAufheben, steuerFestschreiben, steuerSpeichern } from '../../aktionen'

const TON = { fehler: 'rot', warnung: 'gelb', hinweis: 'neutral' } as const

function Tabelle({
  titel,
  zeilen,
  summe,
  testId,
}: {
  titel: string
  zeilen: SteuerZeile[]
  summe: number
  testId: string
}) {
  return (
    <table className="vergleich" data-testid={testId}>
      <thead>
        <tr>
          <th>{titel}</th>
          <th className="betrag">Betrag</th>
        </tr>
      </thead>
      <tbody>
        {zeilen.map((z) => (
          <tr key={z.bezeichnung}>
            <td>{z.bezeichnung}</td>
            <td className="betrag">{euroAnzeige(z.betragCent)}</td>
          </tr>
        ))}
        <tr>
          <th>Summe</th>
          <th className="betrag" data-testid={testId + '-summe'}>
            {euroAnzeige(summe)}
          </th>
        </tr>
      </tbody>
    </table>
  )
}

function Korrekturen({ s }: { s: SteuerSeite }) {
  const k = s.korrekturen
  const weitere = k.weitere ?? []
  return (
    <div className="karte">
      <h2>Korrekturen</h2>
      <p className="leise">
        Was die Daten nicht wissen: Mietausfall, Hausgeld laut WEG-Abrechnung, Zinsen laut
        Bescheinigung der Bank, weitere Werbungskosten ohne Beleg im Journal.
      </p>
      <Formular aktion={steuerSpeichern} knopf="Speichern und rechnen" testId="steuer-korrekturen">
        <input type="hidden" name="objektId" value={s.objekt.id} />
        <input type="hidden" name="jahr" value={s.jahr} />
        <div className="feldreihe">
          <Feld
            label="Mietausfall €"
            name="mietausfall"
            inputMode="decimal"
            defaultValue={k.mietausfallCent ? euroText(k.mietausfallCent) : ''}
            hinweis="Soll-Miete, die nicht gezahlt wurde"
          />
          <Feld
            label="Schuldzinsen laut Bescheinigung €"
            name="schuldzinsen"
            inputMode="decimal"
            defaultValue={k.schuldzinsenCent != null ? euroText(k.schuldzinsenCent) : ''}
            hinweis="Leer: Schuldzinsen aus dem Journal"
          />
        </div>
        <fieldset>
          <legend>Hausgeld (WEG-Abrechnung)</legend>
          <div className="feldreihe">
            <Feld
              label="Hausgeld gezahlt €"
              name="hausgeldGezahlt"
              inputMode="decimal"
              defaultValue={k.hausgeld ? euroText(k.hausgeld.gezahltCent) : ''}
            />
            <Feld
              label="Zuführung Erhaltungsrücklage €"
              name="hausgeldZufuehrung"
              inputMode="decimal"
              defaultValue={k.hausgeld ? euroText(k.hausgeld.zufuehrungCent) : ''}
            />
            <Feld
              label="Entnahme für Erhaltung €"
              name="hausgeldEntnahme"
              inputMode="decimal"
              defaultValue={k.hausgeld ? euroText(k.hausgeld.entnahmeCent) : ''}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>Weitere Werbungskosten</legend>
          {Array.from({ length: WEITERE_ZEILEN }, (_, i) => (
            <div key={i} className="feldreihe">
              <Feld
                label="Bezeichnung"
                name={'weitereBez_' + i}
                defaultValue={weitere[i]?.bezeichnung ?? ''}
              />
              <Feld
                label="Betrag €"
                name={'weitereBetrag_' + i}
                inputMode="decimal"
                defaultValue={weitere[i] ? euroText(weitere[i].betragCent) : ''}
              />
            </div>
          ))}
        </fieldset>
        <label>
          Notizen für den Steuerberater
          <textarea name="notizen" rows={3} defaultValue={s.notizen ?? ''} />
        </label>
      </Formular>
    </div>
  )
}

export default async function SteuerSeiteAnsicht({
  params,
}: {
  params: Promise<{ objektId: string; jahr: string }>
}) {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const { objektId, jahr: j } = await params
  const jahr = Number(j)
  if (!Number.isInteger(jahr) || jahr < 2000 || jahr > 2100) notFound()
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const exportieren = await darf({ export: ['steuerpaket'] })
  const s = await mitMandant((tx) => ladeSteuerSeite(tx, objektId, jahr))
  if (!s) notFound()
  const r = s.ergebnis
  const fest = s.status === 'festgeschrieben'
  const fehler = r.befunde.some((b) => b.schwere === 'fehler')
  const paketId = s.paket?.version.paketDokumentId
  const ohneBeleg = s.journal.filter((x) => !x.dokumentId)

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/steuer">Steuer</Link>
        <span aria-hidden>/</span>
        <Link href={'/objekte/' + s.objekt.id}>{s.objekt.bezeichnung}</Link>
      </nav>
      <div className="seitenkopf">
        <div>
          <h1 data-testid="steuer-titel">
            Einkünfte aus Vermietung {jahr} · {s.objekt.bezeichnung}
          </h1>
          <p className="meta">
            <Status ton={fest ? 'gruen' : 'neutral'}>{STATUS_TEXT[s.status]}</Status>
            <Link href={'/steuer/' + s.objekt.id + '/' + (jahr - 1)}>{jahr - 1}</Link>
            <Link href={'/steuer/' + s.objekt.id + '/' + (jahr + 1)}>{jahr + 1}</Link>
          </p>
        </div>
      </div>

      {r.befunde.length ? (
        <div className="karte" data-testid="steuer-befunde">
          <h2>Prüfung</h2>
          <ul className="liste-schlicht">
            {r.befunde.map((b) => (
              <li key={b.code} data-code={b.code}>
                <Status ton={TON[b.schwere]}>
                  {b.schwere === 'fehler'
                    ? 'Fehler'
                    : b.schwere === 'warnung'
                      ? 'prüfen'
                      : 'Hinweis'}
                </Status>{' '}
                {b.text}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="karte tabelle-scroll" data-testid="steuer-ergebnis">
        <h2>Ergebnis</h2>
        <Tabelle
          titel="Einnahmen"
          zeilen={r.einnahmen}
          summe={r.einnahmenCent}
          testId="steuer-einnahmen"
        />
        <Tabelle
          titel="Werbungskosten"
          zeilen={r.werbungskosten}
          summe={r.werbungskostenCent}
          testId="steuer-werbungskosten"
        />
        <div className="kennzahl betont">
          <span>{r.ueberschussCent >= 0 ? 'Überschuss' : 'Verlust'}</span>
          <span data-testid="steuer-ueberschuss">{euroAnzeige(r.ueberschussCent)}</span>
        </div>
        {r.verteilt.length ? (
          <table className="vergleich">
            <thead>
              <tr>
                <th>Verteilter Erhaltungsaufwand (§ 82b EStDV)</th>
                <th>gezahlt</th>
                <th>Jahre</th>
                <th className="betrag">Anteil {jahr}</th>
              </tr>
            </thead>
            <tbody>
              {r.verteilt.map((v) => (
                <tr key={v.belegnummer}>
                  <td>Beleg {v.belegnummer}</td>
                  <td>{v.jahrDerZahlung}</td>
                  <td>{v.jahre}</td>
                  <td className="betrag">{euroAnzeige(v.anteilCent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      {r.anschaffungsnah ? (
        <div className="karte" data-testid="steuer-15">
          <h2>Anschaffungsnahe Herstellungskosten</h2>
          <p className="leise">
            Erhaltungsaufwand netto in den ersten drei Jahren nach Anschaffung (bis{' '}
            {datumAnzeige(r.anschaffungsnah.bisDatum)}). Über 15 % der Gebäude-Anschaffungskosten
            wird er zu Herstellungskosten (§ 6 Abs. 1 Nr. 1a EStG) und nur über die AfA wirksam.
          </p>
          <meter
            min={0}
            max={r.anschaffungsnah.grenzeCent}
            low={Math.round(r.anschaffungsnah.grenzeCent * 0.8)}
            high={r.anschaffungsnah.grenzeCent}
            optimum={0}
            value={r.anschaffungsnah.nettoCent}
            style={{ width: '100%' }}
          />
          <p>
            {euroAnzeige(r.anschaffungsnah.nettoCent)} von{' '}
            {euroAnzeige(r.anschaffungsnah.grenzeCent)}
          </p>
        </div>
      ) : null}

      {r.aufteilung.length ? (
        <div className="karte tabelle-scroll">
          <h2>Aufteilung nach Miteigentum</h2>
          <table className="vergleich" data-testid="steuer-aufteilung">
            <thead>
              <tr>
                <th>Eigentümer</th>
                <th className="betrag">Einnahmen</th>
                <th className="betrag">Werbungskosten</th>
                <th className="betrag">Ergebnis</th>
              </tr>
            </thead>
            <tbody>
              {r.aufteilung.map((a) => (
                <tr key={a.personId}>
                  <td>{a.name}</td>
                  <td className="betrag">{euroAnzeige(a.einnahmenCent)}</td>
                  <td className="betrag">{euroAnzeige(a.werbungskostenCent)}</td>
                  <td className="betrag">{euroAnzeige(a.ueberschussCent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="karte tabelle-scroll">
        <h2>Buchungen {jahr}</h2>
        <p className="leise">
          {s.journal.length} Buchungen am Objekt
          {ohneBeleg.length
            ? ', ohne Beleg: ' + ohneBeleg.map((x) => x.belegnummer).join(', ')
            : ''}
          . <Link href={'/journal?jahr=' + jahr + '&objekt=' + s.objekt.id}>Zum Journal</Link>
        </p>
        {s.journal.length ? (
          <table className="vergleich">
            <thead>
              <tr>
                <th>Beleg</th>
                <th>Datum</th>
                <th>Kategorie</th>
                <th>Gegenpartei</th>
                <th className="betrag">Betrag</th>
              </tr>
            </thead>
            <tbody>
              {s.journal.map((x) => (
                <tr key={x.id}>
                  <td>{x.belegnummer}</td>
                  <td>{datumAnzeige(x.zahlungsdatum)}</td>
                  <td>
                    {STEUERKATEGORIE_TEXT[x.steuerkategorie as keyof typeof STEUERKATEGORIE_TEXT] ??
                      x.steuerkategorie}
                  </td>
                  <td>{x.gegenpartei}</td>
                  <td className="betrag">{euroAnzeige(x.betragCent)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </div>

      <div className="karte">
        <h2>Grundlagen</h2>
        <ul className="liste-schlicht">
          {s.grundlagen.map((g) => (
            <li key={g} className="leise">
              {g}
            </li>
          ))}
        </ul>
      </div>

      {fest ? (
        <div className="karte" data-testid="steuer-paket">
          <h2>Paket für den Steuerberater</h2>
          <p className="leise">
            ZIP mit Übersicht (PDF), Journal (CSV), Belegen, Prüfprotokoll und Prüfsummen
            (manifest.sha256).
          </p>
          {paketId && exportieren ? (
            <p>
              <a className="knopf" href={'/api/dokument/' + paketId} data-testid="steuer-download">
                Steuerpaket {jahr} herunterladen
              </a>
            </p>
          ) : null}
          {schreiben ? (
            <details>
              <summary>Korrigieren</summary>
              <p className="leise">
                Hebt die Festschreibung auf; das Paket gilt danach als ersetzt.
              </p>
              <Formular
                aktion={steuerAufheben}
                knopf="Festschreibung aufheben"
                zweit
                testId="steuer-aufheben"
              >
                <input type="hidden" name="objektId" value={s.objekt.id} />
                <input type="hidden" name="jahr" value={jahr} />
                <Feld label="Grund der Korrektur" name="grund" required />
              </Formular>
            </details>
          ) : null}
        </div>
      ) : null}

      {!fest && schreiben && exportieren ? (
        <div className="karte" data-testid="steuer-festschreiben">
          <h2>Festschreiben</h2>
          <p className="leise">
            Erstellt das Paket für den Steuerberater und sperrt die Zahlen. Spätere Änderungen nur
            über eine Korrektur.
          </p>
          <Formular
            aktion={steuerFestschreiben}
            knopf="Festschreiben und Paket erstellen"
            testId="steuer-festschreiben-formular"
          >
            <input type="hidden" name="objektId" value={s.objekt.id} />
            <input type="hidden" name="jahr" value={jahr} />
            {fehler ? (
              <label className="inline">
                <input type="checkbox" name="bestaetigt" required /> Fehler aus der Prüfung mit dem
                Steuerberater geklärt, trotzdem festschreiben
              </label>
            ) : null}
          </Formular>
        </div>
      ) : null}

      {!fest && schreiben ? <Korrekturen s={s} /> : null}
    </>
  )
}
