import type {
  GrundbuchAuswertung,
  KaufvertragAuswertung,
  KaufvertragAuszug,
  Pruefergebnis,
} from '@vermieteros/ki'
import type { ObjektDaten } from '@vermieteros/schema'
import { CircleCheck, FileSearch, TriangleAlert } from 'lucide-react'
import { Formular } from '@/components/formular'
import { KiHinweis } from '@/components/ki-hinweis'
import { ScanBestaetigung } from '@/components/scan-bestaetigung'
import { Status } from '@/components/status'
import { datumAnzeige, euroAnzeige } from '@/lib/format'
import { kaufvertragUebernehmen, vertragAuslesen, vertragVerwerfen } from '../aktionen'

const FELD_TEXT: Record<KaufvertragAuswertung['feld'], string> = {
  kaufvertrag_datum: 'Datum Kaufvertrag',
  uebergang_nutzen_lasten: 'Übergang von Nutzen und Lasten',
  kaufpreis: 'Kaufpreis',
  anteil_grund_boden: 'davon Grund und Boden',
}

const GRUNDBUCH_TEXT: Record<string, string> = {
  grundbuch: 'Grundbuch',
  wohnungsgrundbuch: 'Wohnungsgrundbuch',
  teileigentumsgrundbuch: 'Teileigentumsgrundbuch',
}

function anzeige(feld: KaufvertragAuswertung['feld'], wert: unknown): string {
  if (wert === null || wert === undefined) return '–'
  return feld === 'kaufvertrag_datum' || feld === 'uebergang_nutzen_lasten'
    ? datumAnzeige(String(wert))
    : euroAnzeige(Number(wert))
}

function Pruefung({ p, seite, zitat }: { p: Pruefergebnis; seite: number; zitat?: string }) {
  return (
    <span className="leise" style={{ display: 'block' }}>
      {p === 'belegt' ? (
        <>
          <CircleCheck size={13} aria-hidden color="var(--gruen)" /> S. {seite}
          {zitat ? ': „' + zitat + '“' : ''}
        </>
      ) : (
        <>
          <TriangleAlert size={13} aria-hidden color="var(--gelb)" />{' '}
          {p === 'scan'
            ? 'Scan ohne Text, bitte am Dokument prüfen'
            : 'nicht belegt (S. ' + seite + ')'}
        </>
      )}
    </span>
  )
}

function blattText(g: GrundbuchAuswertung, art: string): string {
  const e = g.eintrag
  if (!e) return GRUNDBUCH_TEXT[art] ?? 'Grundbuch'
  const mea = e.miteigentumsanteil
    ? ', ' + e.miteigentumsanteil.zaehler + '/' + e.miteigentumsanteil.nenner + ' MEA'
    : ''
  const flst = e.flurstuecke.map((f) => f.nummer + ' (' + f.flaecheQm + ' m²)').join(', ')
  return GRUNDBUCH_TEXT[e.art] + ' ' + e.amtsgericht + ', Blatt ' + e.blatt + mea + ': ' + flst
}

/**
 * Eckdaten aus einem Kaufvertrag: Vergleich mit der Objektakte, Übernahme nur belegter Werte.
 * Erfasst-Spalte zeigt den aktuellen Stand im Objekt.
 */
export function KaufvertragKarte(p: {
  dokumentId: string
  gueltig: boolean
  schreiben: boolean
  ki: boolean
  vorschlag: { id: string; status: string } | null
  aktiv: { id: string; status: string; ausgabe: unknown } | null
  felder: KaufvertragAuswertung[]
  grundbuch: GrundbuchAuswertung[]
  objekt: ObjektDaten | null
}) {
  const erfasst: Record<KaufvertragAuswertung['feld'], unknown> = {
    kaufvertrag_datum: p.objekt?.kaufvertragDatum,
    uebergang_nutzen_lasten: p.objekt?.anschaffungsdatum,
    kaufpreis: p.objekt?.kaufpreisCent,
    anteil_grund_boden: null,
  }
  const vorhanden = new Set((p.objekt?.grundbuch ?? []).map((g) => g.amtsgericht + '|' + g.blatt))
  const auszug = p.aktiv?.ausgabe as KaufvertragAuszug | undefined

  return (
    <div className="karte" data-testid="kaufvertrag">
      <h2>
        <FileSearch size={18} aria-hidden style={{ verticalAlign: '-3px', marginRight: 6 }} />
        Eckdaten aus dem Kaufvertrag
      </h2>
      {!p.aktiv ? (
        <>
          <p className="leise">
            {p.vorschlag?.status === 'veraltet'
              ? 'Die letzte Auswertung ist veraltet.'
              : p.vorschlag?.status === 'verworfen'
                ? 'Die letzte Auswertung wurde verworfen.'
                : 'Die KI liest Datum, Übergang von Nutzen und Lasten, Kaufpreis, eine Aufteilung auf Grund und Boden und die Grundbuchangaben mit Seitenangabe aus. Übernommen wird nur, was du bestätigst und was wörtlich im PDF steht.'}
          </p>
          {p.schreiben && p.gueltig ? (
            p.ki ? (
              <>
                <Formular
                  aktion={vertragAuslesen}
                  knopf="Vertrag auslesen"
                  testId="vertrag-auslesen"
                >
                  <input type="hidden" name="dokumentId" value={p.dokumentId} />
                </Formular>
                <KiHinweis was="Der Kaufvertrag" />
              </>
            ) : (
              <p className="leise">Die KI ist in dieser Installation nicht eingerichtet.</p>
            )
          ) : null}
        </>
      ) : (
        <>
          <Formular
            aktion={kaufvertragUebernehmen}
            knopf={
              p.aktiv.status === 'bestaetigt' ? 'Erneut übernehmen' : 'Angehakte Werte übernehmen'
            }
            testId="kaufvertrag-uebernehmen"
          >
            <input type="hidden" name="dokumentId" value={p.dokumentId} />
            <input type="hidden" name="vorschlagId" value={p.aktiv.id} />
            <table className="vergleich" data-testid="kaufvertrag-werte">
              <thead>
                <tr>
                  <th>Angabe</th>
                  <th>Im Vertrag</th>
                  <th>Erfasst</th>
                  <th>Übernehmen</th>
                </tr>
              </thead>
              <tbody>
                {p.felder.map((w) => {
                  const gleich = String(w.normiert) === String(erfasst[w.feld] ?? '')
                  return (
                    <tr key={w.feld} data-feld={w.feld}>
                      <td>{FELD_TEXT[w.feld]}</td>
                      <td>
                        <strong className="ziffern">{anzeige(w.feld, w.normiert)}</strong>
                        <Pruefung p={w.pruefung} seite={w.seite} zitat={w.zitat} />
                      </td>
                      <td className="ziffern">
                        {w.feld === 'anteil_grund_boden'
                          ? p.objekt?.gebaeudeanteilPromille != null
                            ? 'Gebäude ' +
                              (p.objekt.gebaeudeanteilPromille / 10).toLocaleString('de-DE') +
                              ' %'
                            : '–'
                          : anzeige(w.feld, erfasst[w.feld])}
                      </td>
                      <td>
                        {(w.pruefung === 'belegt' || w.pruefung === 'scan') &&
                        w.normiert !== null &&
                        !gleich ? (
                          <input
                            type="checkbox"
                            name="felder"
                            value={w.feld}
                            defaultChecked
                            aria-label={FELD_TEXT[w.feld] + ' übernehmen'}
                          />
                        ) : gleich ? (
                          <span className="leise">gleich</span>
                        ) : (
                          <span className="leise">–</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
                {p.grundbuch.map((g) => {
                  const art = auszug?.grundbuch[g.index]?.art ?? 'grundbuch'
                  const bekannt =
                    g.eintrag && vorhanden.has(g.eintrag.amtsgericht + '|' + g.eintrag.blatt)
                  const uebernehmbar =
                    (g.pruefung === 'belegt' || g.pruefung === 'scan') && g.eintrag !== null
                  return (
                    <tr key={'gb' + g.index} data-feld={'grundbuch_' + g.index}>
                      <td>Grundbuch {g.index + 1}</td>
                      <td>
                        <strong>{blattText(g, art)}</strong>
                        {uebernehmbar ? (
                          <Pruefung p={g.pruefung} seite={g.fundstellen[0]?.seite ?? 1} />
                        ) : (
                          <span className="leise" style={{ display: 'block' }}>
                            <TriangleAlert size={13} aria-hidden color="var(--gelb)" />{' '}
                            {g.pruefung === 'scan'
                              ? 'Scan ohne Text, bitte selbst prüfen'
                              : 'nicht vollständig belegt: ' +
                                g.fundstellen
                                  .filter((f) => f.pruefung !== 'belegt')
                                  .map((f) => f.name)
                                  .join(', ')}
                          </span>
                        )}
                      </td>
                      <td>{bekannt ? 'Blatt erfasst' : '–'}</td>
                      <td>
                        {uebernehmbar ? (
                          <input
                            type="checkbox"
                            name="felder"
                            value={'grundbuch_' + g.index}
                            defaultChecked
                            aria-label={'Grundbuch ' + (g.index + 1) + ' übernehmen'}
                          />
                        ) : (
                          <span className="leise">–</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {p.felder.some((w) => w.pruefung === 'scan') ||
            p.grundbuch.some((g) => g.pruefung === 'scan') ? (
              <ScanBestaetigung />
            ) : null}
            {auszug?.hinweise.length ? (
              <ul className="leise" data-testid="kaufvertrag-hinweise">
                {auszug.hinweise.map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            ) : null}
            <p className="leise">
              Grundbuchblätter mit gleichem Amtsgericht und Blatt werden ersetzt, andere ergänzt.
              Der Gebäudeanteil wird nur aus einer ausdrücklichen Aufteilung im Vertrag berechnet.
            </p>
          </Formular>
          {p.aktiv.status === 'offen' ? (
            <Formular
              aktion={vertragVerwerfen}
              knopf="Auswertung verwerfen"
              testId="vertrag-verwerfen"
              zweit
            >
              <input type="hidden" name="dokumentId" value={p.dokumentId} />
              <input type="hidden" name="vorschlagId" value={p.aktiv.id} />
            </Formular>
          ) : (
            <Status ton="gruen">übernommen</Status>
          )}
        </>
      )}
    </div>
  )
}
