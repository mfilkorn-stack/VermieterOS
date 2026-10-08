import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { MieterPersonen } from '@/components/mieter-personen'
import { ladeAkte } from '@/lib/akte'
import { datumAnzeige, euroAnzeige, euroText } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'
import {
  konditionAendern,
  mieterAuszug,
  mieterBearbeiten,
  mieterEinzug,
  mietverhaeltnisBeenden,
  vermietungAnlegen,
} from '../../../aktionen'

const MIETARTEN = [
  ['vergleich', 'Vergleichsmiete (§ 558 BGB)'],
  ['index', 'Indexmiete (§ 557b BGB)'],
  ['staffel', 'Staffelmiete (§ 557a BGB)'],
] as const

const KONDITION_GRUENDE = [
  ['erhoehung_558', 'Mieterhöhung Vergleichsmiete'],
  ['index_557b', 'Indexanpassung'],
  ['staffel_557a', 'Staffelstufe'],
  ['modernisierung_559', 'Modernisierungsumlage'],
  ['anpassung_vorauszahlung', 'Anpassung Vorauszahlungen'],
  ['vereinbarung', 'Vereinbarung'],
] as const

function Konditionsfelder({
  k,
}: {
  k?: {
    kaltmieteCent: number
    vorauszahlungBkCent: number
    vorauszahlungHkCent: number
    personenzahl: number
  }
}) {
  return (
    <>
      <div className="zeile">
        <Feld
          label="Kaltmiete €"
          name="kaltmiete"
          defaultValue={euroText(k?.kaltmieteCent)}
          inputMode="decimal"
          required
        />
        <Feld
          label="Personen im Haushalt"
          name="personenzahl"
          defaultValue={k?.personenzahl ?? 1}
          inputMode="numeric"
        />
      </div>
      <div className="zeile">
        <Feld
          label="Vorauszahlung Betriebskosten €"
          name="vorauszahlungBk"
          defaultValue={euroText(k?.vorauszahlungBkCent)}
          inputMode="decimal"
        />
        <Feld
          label="Vorauszahlung Heizkosten €"
          name="vorauszahlungHk"
          defaultValue={euroText(k?.vorauszahlungHkCent)}
          inputMode="decimal"
        />
      </div>
    </>
  )
}

export default async function VermietungSeite({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; eid: string }>
  searchParams: Promise<{ neu?: string }>
}) {
  const { id, eid } = await params
  const neu = (await searchParams).neu === '1'
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  const einheit = akte?.einheiten.find((e) => e.id === eid)
  if (!akte || !einheit) notFound()
  const laufend = einheit.mietverhaeltnisse.some((m) => !m.v.ende || m.v.ende >= heuteBerlin())
  const verstecktes = (
    <>
      <input type="hidden" name="objektId" value={id} />
      <input type="hidden" name="einheitId" value={eid} />
    </>
  )

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/">Objekte</Link>
        <span aria-hidden>/</span>
        <Link href={`/objekte/${id}`}>{akte.objekt.bezeichnung}</Link>
        <span aria-hidden>/</span>
        <span>{einheit.v.bezeichnung} · Mietverhältnisse</span>
      </nav>
      <h1>Mietverhältnisse · {einheit.v.bezeichnung}</h1>

      {einheit.mietverhaeltnisse.map((m) => (
        <div key={m.id} className="karte" data-testid="mietverhaeltnis">
          <h2>
            {m.mieter.join(', ')} · seit {datumAnzeige(m.v.beginn)}
            {m.v.ende ? ` bis ${datumAnzeige(m.v.ende)}` : ''}
          </h2>
          <p>
            <Link href={`/mietverhaeltnisse/${m.id}`} data-testid="verlauf-link">
              Zum Mietverhältnis (Verlauf, Dokumente, Portal)
            </Link>
          </p>
          <ul className="mietpartei" data-testid="mietpartei">
            {m.personen.map((p) => {
              const name = [p.v.vorname, p.v.nachname].filter(Boolean).join(' ')
              return (
                <li key={p.id} data-testid="mieter-person">
                  <strong>{name}</strong>
                  {p.v.email || p.v.telefon ? (
                    <span className="leise">
                      {' · ' + [p.v.email, p.v.telefon].filter(Boolean).join(' · ')}
                    </span>
                  ) : null}
                  <details>
                    <summary>Bearbeiten</summary>
                    <Formular
                      key={'p' + p.v.versionNr}
                      aktion={mieterBearbeiten}
                      knopf="Änderungen speichern"
                      testId={'mieter-bearbeiten-' + name}
                    >
                      {verstecktes}
                      <input type="hidden" name="mietverhaeltnisId" value={m.id} />
                      <input type="hidden" name="personId" value={p.id} />
                      <div className="zeile">
                        <Feld label="Vorname" name="vorname" defaultValue={p.v.vorname ?? ''} />
                        <Feld
                          label="Nachname"
                          name="nachname"
                          defaultValue={p.v.nachname}
                          required
                        />
                      </div>
                      <div className="zeile">
                        <Feld
                          label="E-Mail"
                          name="email"
                          type="email"
                          defaultValue={p.v.email ?? ''}
                        />
                        <Feld label="Telefon" name="telefon" defaultValue={p.v.telefon ?? ''} />
                      </div>
                    </Formular>
                  </details>
                  {!m.v.ende && m.personen.length > 1 ? (
                    <details>
                      <summary>Auszug</summary>
                      <Formular
                        aktion={mieterAuszug}
                        knopf="Auszug speichern"
                        testId={'mieter-auszug-' + name}
                      >
                        {verstecktes}
                        <input type="hidden" name="mietverhaeltnisId" value={m.id} />
                        <input type="hidden" name="personId" value={p.id} />
                        <Feld label="Auszug am" name="ab" type="date" required />
                        <label className="haken">
                          <input type="checkbox" name="personenzahl" defaultChecked /> Personen im
                          Haushalt um 1 verringern
                        </label>
                        <p className="leise">
                          Das Mietverhältnis läuft mit den übrigen Personen weiter. Ein Zugang zum
                          Mieterportal für diese Person wird gesperrt.
                        </p>
                      </Formular>
                    </details>
                  ) : null}
                </li>
              )
            })}
          </ul>
          {!m.v.ende ? (
            <details>
              <summary>Weitere Person zieht ein</summary>
              <Formular aktion={mieterEinzug} knopf="Einzug speichern" testId="mieter-einzug">
                {verstecktes}
                <input type="hidden" name="mietverhaeltnisId" value={m.id} />
                <div className="zeile">
                  <Feld label="Vorname" name="vorname" />
                  <Feld label="Nachname" name="nachname" required />
                </div>
                <div className="zeile">
                  <Feld label="E-Mail" name="email" type="email" />
                  <Feld label="Telefon" name="telefon" />
                </div>
                <Feld label="Einzug am" name="ab" type="date" required />
                <label className="haken">
                  <input type="checkbox" name="personenzahl" defaultChecked /> Personen im Haushalt
                  um 1 erhöhen
                </label>
              </Formular>
            </details>
          ) : null}
          {m.kondition ? (
            <p>
              Kaltmiete {euroAnzeige(m.kondition.v.kaltmieteCent)} · Vorauszahlungen{' '}
              {euroAnzeige(m.kondition.v.vorauszahlungBkCent + m.kondition.v.vorauszahlungHkCent)} ·
              gilt ab {datumAnzeige(m.kondition.v.gueltigAb)}
            </p>
          ) : null}
          {m.kondition ? (
            <details>
              <summary>Neue Mietkondition (Erhöhung, Anpassung)</summary>
              <Formular
                key={'k' + m.kondition.v.versionNr}
                aktion={konditionAendern}
                knopf="Kondition speichern"
              >
                {verstecktes}
                <input type="hidden" name="konditionId" value={m.kondition.id} />
                <input type="hidden" name="mietart" value={m.kondition.v.mietart} />
                <Konditionsfelder k={m.kondition.v} />
                <Auswahl label="Grund" name="grund" optionen={KONDITION_GRUENDE} />
                <Feld label="Gilt ab" name="giltAb" type="date" required />
                <Feld label="Begründung" name="begruendung" hinweis="z. B. Zustimmung vom …" />
              </Formular>
            </details>
          ) : null}
          {!m.v.ende ? (
            <details>
              <summary>Mietende eintragen</summary>
              <Formular aktion={mietverhaeltnisBeenden} knopf="Mietende speichern">
                {verstecktes}
                <input type="hidden" name="mietverhaeltnisId" value={m.id} />
                <Feld label="Mietende" name="ende" type="date" required />
              </Formular>
            </details>
          ) : null}
        </div>
      ))}

      {neu ? (
        <p className="karte" data-testid="einheit-neu-hinweis">
          Einheit angelegt. Jetzt das Mietverhältnis erfassen, oder später über „Mietverhältnisse“
          an der Einheit.
        </p>
      ) : null}
      <details className="karte" open={!laufend} data-testid="neues-mietverhaeltnis">
        <summary>
          <h2 style={{ display: 'inline', margin: 0 }}>
            {laufend ? 'Nachmieter anlegen' : 'Neues Mietverhältnis'}
          </h2>
        </summary>
        <Formular aktion={vermietungAnlegen} knopf="Mietverhältnis anlegen" testId="vermietung">
          {verstecktes}
          <MieterPersonen />
          <div className="zeile">
            <Feld label="Mietbeginn" name="beginn" type="date" required />
            <Feld label="Mietende (falls befristet)" name="ende" type="date" />
          </div>
          <Auswahl label="Mietart" name="mietart" optionen={MIETARTEN} />
          <Konditionsfelder />
          <div className="zeile">
            <Feld label="Kaution €" name="kaution" inputMode="decimal" />
            <Auswahl
              label="Kautionsart"
              name="kautionArt"
              optionen={[
                ['bar', 'Barkaution / Konto'],
                ['buergschaft', 'Bürgschaft'],
                ['sparbuch', 'Sparbuch'],
                ['versicherung', 'Kautionsversicherung'],
                ['keine', 'Keine'],
              ]}
            />
            <Feld
              label="Kündigungsfrist Monate"
              name="kuendigungsfrist"
              defaultValue="3"
              inputMode="numeric"
            />
          </div>
        </Formular>
      </details>
    </>
  )
}
