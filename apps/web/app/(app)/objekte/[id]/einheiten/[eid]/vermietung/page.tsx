import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { ladeAkte } from '@/lib/akte'
import { datumAnzeige, euroAnzeige, euroText } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { konditionAendern, mietverhaeltnisBeenden, vermietungAnlegen } from '../../../aktionen'

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
}: {
  params: Promise<{ id: string; eid: string }>
}) {
  const { id, eid } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  const einheit = akte?.einheiten.find((e) => e.id === eid)
  if (!akte || !einheit) notFound()
  const verstecktes = (
    <>
      <input type="hidden" name="objektId" value={id} />
      <input type="hidden" name="einheitId" value={eid} />
    </>
  )

  return (
    <>
      <p className="leise">
        <Link href={`/objekte/${id}`}>{akte.objekt.bezeichnung}</Link>
      </p>
      <h1>Vermietung · {einheit.v.bezeichnung}</h1>

      {einheit.mietverhaeltnisse.map((m) => (
        <div key={m.id} className="karte" data-testid="mietverhaeltnis">
          <h2>
            {m.mieter.join(', ')} · seit {datumAnzeige(m.v.beginn)}
            {m.v.ende ? ` bis ${datumAnzeige(m.v.ende)}` : ''}
          </h2>
          <p>
            <Link href={`/mietverhaeltnisse/${m.id}`} data-testid="verlauf-link">
              Verlauf und Dokumente
            </Link>
          </p>
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
              <Formular aktion={konditionAendern} knopf="Kondition speichern">
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

      <div className="karte">
        <h2>Neues Mietverhältnis</h2>
        <Formular aktion={vermietungAnlegen} knopf="Mietverhältnis anlegen" testId="vermietung">
          {verstecktes}
          <div className="zeile">
            <Feld label="Vorname" name="vorname" />
            <Feld label="Nachname" name="nachname" required />
          </div>
          <div className="zeile">
            <Feld label="E-Mail" name="email" type="email" />
            <Feld label="Telefon" name="telefon" />
          </div>
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
      </div>
    </>
  )
}
