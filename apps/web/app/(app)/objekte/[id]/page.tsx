import {
  afaImJahr,
  afaJahresbetrag,
  anschaffungskosten,
  anteiligeGrundstuecksflaeche,
  cent,
  fristen,
  grenzeAnschaffungsnaheHk,
  MODULE,
  type Befund,
  type Modul,
} from '@vermieteros/rechenkern'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ladeAkte, type Akte } from '@/lib/akte'
import { datumAnzeige, dezimalText, euroAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'

const MODUL_TEXT: Record<Modul, string> = {
  stammdaten: 'Stammdaten',
  nebenkosten: 'Nebenkosten',
  steuerpaket: 'Steuerpaket',
  mieterhoehung: 'Mieterhöhung',
  finanzen: 'Finanzen',
}

const TYP_TEXT: Record<string, string> = {
  wohnung: 'Wohnung',
  gewerbe: 'Gewerbe',
  stellplatz: 'Stellplatz',
  sonstiges: 'Sonstiges',
}

const STAMMDATEN_CODES = new Set([
  'OBJ_ADRESSE',
  'OBJ_GRUNDBUCH',
  'ETW_OHNE_WOHNUNGSGRUNDBUCH',
  'ETW_MEHRERE_WOHNUNGEN',
  'OBJ_BAUJAHR',
  'OBJ_BUNDESLAND',
])

/** Wohin ein Befund führt: das Formular, in dem er behoben wird. */
function ziel(a: Akte, b: Befund): string {
  const basis = `/objekte/${a.id}`
  switch (b.entitaet) {
    case 'mandant':
      return '/eigentuemer'
    case 'einheit':
      return `${basis}/einheiten/${b.id}`
    case 'darlehen':
      return `${basis}/darlehen/${b.id}`
    case 'mietverhaeltnis':
    case 'mietkondition': {
      const e = a.einheiten.find((x) => x.mietverhaeltnisse.some((m) => m.id === b.id))
      return e ? `${basis}/einheiten/${e.id}/vermietung` : basis
    }
    default:
      if (b.code === 'OBJ_KEINE_EINHEITEN') return `${basis}/einheiten/neu`
      if (b.code.startsWith('MEA_')) return `${basis}#einheiten`
      if (b.code.startsWith('REF_')) return '/referenzdaten'
      return STAMMDATEN_CODES.has(b.code) ? `${basis}/stammdaten` : `${basis}/kauf`
  }
}

export default async function ObjektSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const akte = await mitMandant((tx) => ladeAkte(tx, id))
  if (!akte) notFound()
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const o = akte.objekt
  const q = akte.qualitaet
  const jahr = new Date().getFullYear() - 1

  const ak =
    o.kaufpreisCent != null && o.gebaeudeanteilPromille != null
      ? anschaffungskosten(
          cent(o.kaufpreisCent),
          o.anschaffungsnebenkosten ?? [],
          o.gebaeudeanteilPromille,
        )
      : null
  const f = fristen(o.kaufvertragDatum, o.anschaffungsdatum)
  const flaeche = o.grundbuch?.length ? anteiligeGrundstuecksflaeche(o.grundbuch) : null

  return (
    <>
      <p className="leise">
        <Link href="/">Übersicht</Link> · {o.art === 'etw' ? 'Eigentumswohnung' : 'Haus'}
      </p>
      <h1 data-testid="objekt-titel">{o.bezeichnung}</h1>
      <p className="leise">
        {[o.strasse, o.hausnummer].filter(Boolean).join(' ')} {o.plz} {o.ort} · im Bestand seit{' '}
        {datumAnzeige(akte.bestandSeit)}
      </p>

      {q ? (
        <div className="karte">
          <div className="ampeln" data-testid="ampeln">
            {MODULE.map((m) => (
              <span
                key={m}
                className={`ampel ampel-${q.ampel[m]}`}
                data-testid={`ampel-${m}`}
                data-ampel={q.ampel[m]}
              >
                {MODUL_TEXT[m]}
              </span>
            ))}
          </div>
          {q.befunde.length === 0 ? (
            <p data-testid="vollstaendig">Alle Angaben vollständig.</p>
          ) : (
            <>
              <h2>Noch offen</h2>
              <ul className="befunde" data-testid="befunde">
                {q.befunde.map((b, i) => (
                  <li key={i} className={`befund-${b.schwere}`} data-code={b.code}>
                    {schreiben ? <Link href={ziel(akte, b)}>{b.text}</Link> : b.text}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      ) : null}

      <div className="zeile">
        <h2>Stammdaten und Grundbuch</h2>
        {schreiben ? <Link href={`/objekte/${id}/stammdaten`}>Bearbeiten</Link> : null}
      </div>
      <div className="karte kennzahlen">
        <div className="kennzahl">
          <span>Baujahr</span>
          {o.baujahr ?? '–'}
        </div>
        <div className="kennzahl">
          <span>WEG</span>
          {o.weg ? 'ja' : 'nein'}
        </div>
        <div className="kennzahl">
          <span>Grundbuchblätter</span>
          {o.grundbuch?.length ?? 0}
        </div>
        <div className="kennzahl">
          <span>Anteilige Grundstücksfläche</span>
          <span data-testid="grundstuecksflaeche">
            {flaeche != null ? `${dezimalText(flaeche, 2)} m²` : '–'}
          </span>
        </div>
      </div>

      <div className="zeile">
        <h2>Kauf und Abschreibung</h2>
        {schreiben ? <Link href={`/objekte/${id}/kauf`}>Bearbeiten</Link> : null}
      </div>
      <div className="karte kennzahlen" data-testid="kauf-kennzahlen">
        <div className="kennzahl">
          <span>Kaufpreis</span>
          {euroAnzeige(o.kaufpreisCent)}
        </div>
        <div className="kennzahl">
          <span>Anschaffungskosten gesamt</span>
          <span data-testid="ak-gesamt">{euroAnzeige(ak?.gesamt)}</span>
        </div>
        <div className="kennzahl">
          <span>davon Gebäude (AfA-Basis)</span>
          <span data-testid="ak-gebaeude">{euroAnzeige(ak?.gebaeude)}</span>
        </div>
        <div className="kennzahl">
          <span>Finanzierungskosten (sofort abziehbar)</span>
          {euroAnzeige(ak?.finanzierungskosten)}
        </div>
        <div className="kennzahl">
          <span>AfA pro Jahr</span>
          <span data-testid="afa-jahr">
            {ak && o.afaSatzPromille != null
              ? euroAnzeige(afaJahresbetrag(ak.gebaeude, o.afaSatzPromille))
              : '–'}
          </span>
        </div>
        <div className="kennzahl">
          <span>AfA {jahr}</span>
          {ak && o.afaSatzPromille != null && o.afaBeginn
            ? euroAnzeige(afaImJahr(ak.gebaeude, o.afaSatzPromille, o.afaBeginn, jahr))
            : '–'}
        </div>
        <div className="kennzahl">
          <span>15-%-Grenze bis {datumAnzeige(f.anschaffungsnaheHkEnde)}</span>
          {ak ? euroAnzeige(grenzeAnschaffungsnaheHk(ak.gebaeude)) : '–'}
        </div>
        <div className="kennzahl">
          <span>Spekulationsfrist endet</span>
          <span data-testid="spekulationsfrist">{datumAnzeige(f.spekulationsfristEnde)}</span>
        </div>
      </div>

      <div className="zeile" id="einheiten">
        <h2>Einheiten</h2>
        {schreiben ? (
          <Link href={`/objekte/${id}/einheiten/neu`} data-testid="einheit-neu">
            Einheit anlegen
          </Link>
        ) : null}
      </div>
      <ul className="liste" data-testid="einheitenliste">
        {akte.einheiten.map((e) => (
          <li key={e.id} className="karte">
            <div className="zeile">
              <strong>{e.v.bezeichnung}</strong>
              <span className="leise">
                {TYP_TEXT[e.v.typ] ?? e.v.typ}
                {e.v.wohnflaecheQm100 ? ` · ${dezimalText(e.v.wohnflaecheQm100, 2)} m²` : ''}
              </span>
            </div>
            {e.mietverhaeltnisse.map((m) => (
              <p key={m.id} className="leise">
                {m.mieter.join(', ')} seit {datumAnzeige(m.v.beginn)}
                {m.v.ende ? ` bis ${datumAnzeige(m.v.ende)}` : ''}
                {m.kondition ? ` · Kaltmiete ${euroAnzeige(m.kondition.v.kaltmieteCent)}` : ''}
              </p>
            ))}
            {schreiben ? (
              <div className="zeile">
                <Link href={`/objekte/${id}/einheiten/${e.id}`}>Bearbeiten</Link>
                <Link href={`/objekte/${id}/einheiten/${e.id}/vermietung`}>Vermietung</Link>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <div className="zeile">
        <h2>Darlehen</h2>
        {schreiben ? <Link href={`/objekte/${id}/darlehen/neu`}>Darlehen anlegen</Link> : null}
      </div>
      {akte.darlehen.length === 0 ? <p className="leise">Keine Darlehen erfasst.</p> : null}
      <ul className="liste">
        {akte.darlehen.map((d) => (
          <li key={d.id} className="karte zeile">
            <span>
              <strong>{d.v.bank}</strong> {euroAnzeige(d.v.nominalCent)} ·{' '}
              {dezimalText(d.v.zinsBp, 2)} %
              {d.v.zinsbindungBis ? ` · Zinsbindung bis ${datumAnzeige(d.v.zinsbindungBis)}` : ''}
            </span>
            {schreiben ? <Link href={`/objekte/${id}/darlehen/${d.id}`}>Bearbeiten</Link> : null}
          </li>
        ))}
      </ul>
      <p className="leise">
        Kennzahlen sind eine Vorbereitung für den Steuerberater, keine Steuerberatung. Gebäudeanteil
        und AfA-Satz bitte mit dem Berater abstimmen.
      </p>
    </>
  )
}
