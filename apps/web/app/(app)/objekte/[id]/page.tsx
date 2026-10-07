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
} from '@vermieteros/rechenkern'
import {
  Banknote,
  Car,
  CircleX,
  DoorOpen,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Siren,
  Store,
  TriangleAlert,
  Users,
  type LucideIcon,
} from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AmpelStatus, MODUL_ICON, MODUL_TEXT } from '@/components/status'
import {
  journalSummen,
  ladeNotfallkarte,
  listeDokumente,
  listeTickets,
  listeWissen,
} from '@vermieteros/db'
import { DokumentListe } from '@/components/dokument-liste'
import { PrioritaetBadge, TicketStatusBadge } from '@/components/ticket-badges'
import { ladeAkte, type Akte } from '@/lib/akte'
import { NOTFALL_TEXT, WISSEN_TEXT } from '@/lib/betrieb-text'
import { datumAnzeige, dezimalText, euroAnzeige } from '@/lib/format'
import { heuteBerlin } from '@/lib/zeit'
import { darf, mitMandant } from '@/lib/sitzung'

const TYP_TEXT: Record<string, string> = {
  wohnung: 'Wohnung',
  gewerbe: 'Gewerbe',
  stellplatz: 'Stellplatz',
  sonstiges: 'Sonstiges',
}

const TYP_ICON: Record<string, LucideIcon> = {
  wohnung: DoorOpen,
  gewerbe: Store,
  stellplatz: Car,
  sonstiges: DoorOpen,
}

function Abschnitt({
  titel,
  id,
  children,
}: {
  titel: string
  id?: string
  children?: React.ReactNode
}) {
  return (
    <div className="zeile" id={id}>
      <h2>{titel}</h2>
      {children ? <div className="aktionen">{children}</div> : null}
    </div>
  )
}

function Bearbeiten({
  href,
  testId,
  text = 'Bearbeiten',
}: {
  href: string
  testId?: string
  text?: string
}) {
  return (
    <Link className="knopf zweit" href={href} data-testid={testId}>
      {text === 'Bearbeiten' ? <Pencil size={16} aria-hidden /> : <Plus size={16} aria-hidden />}
      {text}
    </Link>
  )
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
  const daten = await mitMandant(async (tx) => {
    const akte = await ladeAkte(tx, id)
    if (!akte) return null
    return {
      akte,
      notfall: await ladeNotfallkarte(tx, id),
      wissen: await listeWissen(tx, id),
      tickets: await listeTickets(tx, { offen: true, objektId: id }),
      dokumente: await listeDokumente(tx, { objektId: id }),
      journal: await journalSummen(tx, { jahr: Number(heuteBerlin().slice(0, 4)), objektId: id }),
    }
  })
  if (!daten) notFound()
  const { akte, notfall, wissen, tickets, dokumente, journal } = daten
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

  const vollstaendig = q ? MODULE.filter((m) => q.ampel[m] === 'gruen').length : 0
  const gruppen = q
    ? MODULE.map((m) => ({ m, befunde: q.befunde.filter((b) => b.modul === m) })).filter(
        (g) => g.befunde.length > 0,
      )
    : []

  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href="/">Objekte</Link>
        <span aria-hidden>/</span>
        <span>{o.art === 'etw' ? 'Eigentumswohnung' : 'Haus'}</span>
      </nav>
      <div className="aktenkopf">
        {q ? (
          <div
            className="ring"
            role="img"
            aria-label={`${vollstaendig} von ${MODULE.length} Modulen vollständig`}
            style={{ ['--anteil' as string]: `${(vollstaendig / MODULE.length) * 100}%` }}
          >
            <span>
              {vollstaendig}/{MODULE.length}
            </span>
          </div>
        ) : null}
        <div className="titel">
          <h1 data-testid="objekt-titel">{o.bezeichnung}</h1>
          <p className="meta">
            <span>
              <MapPin size={15} aria-hidden />
              {[o.strasse, o.hausnummer].filter(Boolean).join(' ')} {o.plz} {o.ort}
            </span>
            <span>im Bestand seit {datumAnzeige(akte.bestandSeit)}</span>
          </p>
        </div>
      </div>

      {q ? (
        <>
          <div className="module" data-testid="ampeln">
            {MODULE.map((m) => {
              const Icon = MODUL_ICON[m]
              return (
                <div key={m} className="modul" data-testid={`ampel-${m}`} data-ampel={q.ampel[m]}>
                  <span className="modul-kopf">
                    <Icon size={18} strokeWidth={1.75} aria-hidden />
                    {MODUL_TEXT[m]}
                  </span>
                  <AmpelStatus ampel={q.ampel[m]} />
                </div>
              )
            })}
          </div>
          <div className="karte">
            {q.befunde.length === 0 ? (
              <p data-testid="vollstaendig" style={{ margin: 0 }}>
                <AmpelStatus ampel="gruen" text="Alle Angaben vollständig." />
              </p>
            ) : (
              <>
                <h2>Noch offen</h2>
                <div data-testid="befunde">
                  {gruppen.map(({ m, befunde }) => {
                    const Icon = MODUL_ICON[m]
                    return (
                      <section key={m} className="befund-gruppe">
                        <h3>
                          <Icon size={14} aria-hidden />
                          {MODUL_TEXT[m]}
                        </h3>
                        <ul className="befunde">
                          {befunde.map((b, i) => (
                            <li key={i} className={`befund-${b.schwere}`} data-code={b.code}>
                              {b.schwere === 'fehler' ? (
                                <CircleX size={16} aria-label="Fehler" />
                              ) : (
                                <TriangleAlert size={16} aria-label="Hinweis" />
                              )}
                              {schreiben ? <Link href={ziel(akte, b)}>{b.text}</Link> : b.text}
                            </li>
                          ))}
                        </ul>
                      </section>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </>
      ) : null}

      <Abschnitt titel="Kauf und Abschreibung">
        {schreiben ? <Bearbeiten href={`/objekte/${id}/kauf`} /> : null}
      </Abschnitt>
      <div className="kennzahlen" data-testid="kauf-kennzahlen">
        <div className="kennzahl">
          <span>Kaufpreis</span>
          {euroAnzeige(o.kaufpreisCent)}
        </div>
        <div className="kennzahl betont">
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
        <div className="kennzahl betont">
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

      <Abschnitt titel="Stammdaten und Grundbuch">
        {schreiben ? <Bearbeiten href={`/objekte/${id}/stammdaten`} /> : null}
      </Abschnitt>
      <div className="kennzahlen">
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

      <Abschnitt titel="Einheiten" id="einheiten">
        {schreiben ? (
          <Bearbeiten
            href={`/objekte/${id}/einheiten/neu`}
            testId="einheit-neu"
            text="Einheit anlegen"
          />
        ) : null}
      </Abschnitt>
      <ul className="liste" data-testid="einheitenliste">
        {akte.einheiten.map((e) => {
          const Icon = TYP_ICON[e.v.typ] ?? DoorOpen
          return (
            <li key={e.id} className="karte objektkarte">
              <div className="objektkarte-kopf">
                <span className="icon-kachel">
                  <Icon size={20} strokeWidth={1.75} aria-hidden />
                </span>
                <span className="objektkarte-titel">
                  <strong>{e.v.bezeichnung}</strong>
                  <span className="meta">
                    <span>
                      {TYP_TEXT[e.v.typ] ?? e.v.typ}
                      {e.v.wohnflaecheQm100 ? ` · ${dezimalText(e.v.wohnflaecheQm100, 2)} m²` : ''}
                    </span>
                  </span>
                </span>
                {schreiben ? (
                  <span className="aktionen">
                    <Link className="knopf zweit" href={`/objekte/${id}/einheiten/${e.id}`}>
                      Bearbeiten
                    </Link>
                    <Link
                      className="knopf zweit"
                      href={`/objekte/${id}/einheiten/${e.id}/vermietung`}
                    >
                      Vermietung
                    </Link>
                  </span>
                ) : null}
              </div>
              {e.mietverhaeltnisse.map((m) => (
                <p key={m.id} className="meta">
                  <span>
                    <Users size={15} aria-hidden />
                    {m.mieter.join(', ')} seit {datumAnzeige(m.v.beginn)}
                    {m.v.ende ? ` bis ${datumAnzeige(m.v.ende)}` : ''}
                  </span>
                  {m.kondition ? (
                    <span className="ziffern">
                      Kaltmiete {euroAnzeige(m.kondition.v.kaltmieteCent)}
                    </span>
                  ) : null}
                </p>
              ))}
            </li>
          )
        })}
      </ul>

      <Abschnitt titel="Darlehen">
        {schreiben ? (
          <Bearbeiten href={`/objekte/${id}/darlehen/neu`} text="Darlehen anlegen" />
        ) : null}
      </Abschnitt>
      {akte.darlehen.length === 0 ? <p className="leise">Keine Darlehen erfasst.</p> : null}
      <ul className="liste">
        {akte.darlehen.map((d) => (
          <li key={d.id} className="karte objektkarte">
            <div className="objektkarte-kopf">
              <span className="icon-kachel">
                <Banknote size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="objektkarte-titel">
                <strong>{d.v.bank}</strong>
                <span className="meta">
                  <span className="ziffern">
                    {euroAnzeige(d.v.nominalCent)} · {dezimalText(d.v.zinsBp, 2)} %
                  </span>
                  {d.v.zinsbindungBis ? (
                    <span>Zinsbindung bis {datumAnzeige(d.v.zinsbindungBis)}</span>
                  ) : null}
                </span>
              </span>
              {schreiben ? (
                <Link className="knopf zweit" href={`/objekte/${id}/darlehen/${d.id}`}>
                  Bearbeiten
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <Abschnitt titel="Tickets">
        {schreiben ? (
          <Bearbeiten
            href={`/tickets/neu?objekt=${id}`}
            text="Ticket anlegen"
            testId="objekt-ticket-neu"
          />
        ) : null}
      </Abschnitt>
      {tickets.length === 0 ? <p className="leise">Keine offenen Tickets.</p> : null}
      <ul className="liste" data-testid="objekt-tickets">
        {tickets.map((t) => (
          <li key={t.id} className="karte zeile">
            <Link href={`/tickets/${t.id}`}>{t.titel}</Link>
            <span className="meta">
              <PrioritaetBadge p={t.prioritaet} />
              <TicketStatusBadge status={t.status} />
            </span>
          </li>
        ))}
      </ul>

      <Abschnitt titel={`Journal ${heuteBerlin().slice(0, 4)}`}>
        <Bearbeiten href={`/journal?objekt=${id}`} text="Journal öffnen" testId="objekt-journal" />
      </Abschnitt>
      <div className="karte" data-testid="objekt-journal-summen">
        {journal.length === 0 ? (
          <p className="leise">Noch keine Buchungen in diesem Jahr.</p>
        ) : (
          <dl className="kopfdaten">
            <dt>Einnahmen</dt>
            <dd className="ziffern">
              {euroAnzeige(
                journal
                  .filter((j) => j.richtung === 'einnahme')
                  .reduce((a, j) => a + j.summeCent, 0),
              )}
            </dd>
            <dt>Ausgaben</dt>
            <dd className="ziffern">
              {euroAnzeige(
                journal
                  .filter((j) => j.richtung === 'ausgabe')
                  .reduce((a, j) => a + j.summeCent, 0),
              )}
            </dd>
          </dl>
        )}
      </div>

      <Abschnitt titel="Dokumente">
        {schreiben ? (
          <Bearbeiten
            href={`/dokumente/neu?objekt=${id}`}
            text="Dokument hochladen"
            testId="objekt-dokument-neu"
          />
        ) : null}
      </Abschnitt>
      <div className="karte">
        <DokumentListe dokumente={dokumente} />
      </div>

      <Abschnitt titel="Notfallkarte">
        {schreiben ? (
          <Bearbeiten
            href={`/objekte/${id}/notfallkarte`}
            testId="notfallkarte-bearbeiten"
            text={notfall ? 'Bearbeiten' : 'Notfallkarte anlegen'}
          />
        ) : null}
      </Abschnitt>
      {notfall?.zeilen.length ? (
        <ul className="karte befunde" data-testid="notfallkarte">
          {notfall.zeilen.map((z, i) => (
            <li key={i}>
              <Siren size={16} aria-hidden color="var(--rot)" />
              <span style={{ flex: 1 }}>
                <strong>{NOTFALL_TEXT[z.art]}</strong> · {z.name}
                {z.hinweis ? <span className="leise"> · {z.hinweis}</span> : null}
              </span>
              {z.telefon ? (
                <a href={`tel:${z.telefon.replace(/[^+\d]/g, '')}`} className="ziffern">
                  <Phone size={14} aria-hidden /> {z.telefon}
                </a>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="leise">Noch keine Notfallkarte. Sie steht später im Mieterportal.</p>
      )}

      <Abschnitt titel="Wissensbasis">
        {schreiben ? (
          <Bearbeiten
            href={`/objekte/${id}/wissen/neu`}
            text="Artikel anlegen"
            testId="wissen-neu"
          />
        ) : null}
      </Abschnitt>
      {wissen.length === 0 ? (
        <p className="leise">Hausordnung, Anleitungen, Müllabfuhr, häufige Fragen.</p>
      ) : null}
      <ul className="liste" data-testid="wissensbasis">
        {wissen.map((w) => (
          <li key={w.id} className="karte zeile">
            {schreiben ? (
              <Link href={`/objekte/${id}/wissen/${w.id}`}>{w.titel}</Link>
            ) : (
              <strong>{w.titel}</strong>
            )}
            <span className="meta">
              <span>{WISSEN_TEXT[w.kategorie]}</span>
              {w.mieterSichtbar ? null : <span>nur intern</span>}
            </span>
          </li>
        ))}
      </ul>

      <p className="leise" style={{ marginTop: 24 }}>
        Kennzahlen sind eine Vorbereitung für den Steuerberater, keine Steuerberatung. Gebäudeanteil
        und AfA-Satz bitte mit dem Berater abstimmen.
      </p>
    </>
  )
}
