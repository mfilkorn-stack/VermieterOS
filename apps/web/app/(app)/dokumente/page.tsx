import { listeAlleDokumente } from '@vermieteros/db'
import { DOKUMENT_TYPEN } from '@vermieteros/schema'
import { Search } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { DokumentListe } from '@/components/dokument-liste'
import { DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { BereichReiter } from '@/components/bereich-reiter'

/**
 * Alle Dokumente über alle Immobilien (N2): Suche nach Titel und Dateiname, Filter nach Objekt und
 * Art. Standard sind die gültigen; ersetzte und abgelaufene auf Wunsch. Belege stehen unter Belegen.
 */
export default async function DokumenteSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; objekt?: string; art?: string; alle?: string }>
}) {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const { q = '', objekt = '', art = '', alle } = await searchParams
  const suche = q.trim().toLowerCase()
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const zeilen = await mitMandant((tx) => listeAlleDokumente(tx))
  const objekte = [
    ...new Map(
      zeilen.filter((z) => z.ortObjektId).map((z) => [z.ortObjektId!, z.ort!.split(' · ')[0]!]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], 'de'))
  const sichtbar = zeilen.filter(
    (z) =>
      (alle || z.status === 'gueltig') &&
      (!objekt || z.ortObjektId === objekt) &&
      (!art || z.typ === art) &&
      (!suche ||
        z.titel.toLowerCase().includes(suche) ||
        z.dateiname.toLowerCase().includes(suche)),
  )
  const gefiltert = Boolean(suche || objekt || art || alle)

  return (
    <>
      <BereichReiter bereich="bestand" aktiv="/dokumente" />
      <div className="seitenkopf">
        <div>
          <h1>Dokumente</h1>
          <p className="leise">
            {zeilen.length === 0
              ? 'Noch keine Dokumente.'
              : sichtbar.length +
                (sichtbar.length === 1 ? ' Dokument' : ' Dokumente') +
                (gefiltert
                  ? sichtbar.length === 1
                    ? ' passt zum Filter.'
                    : ' passen zum Filter.'
                  : ' über alle Immobilien.') +
                ' Belege stehen unter '}
            {zeilen.length ? <Link href="/belege">Belegen</Link> : null}
            {zeilen.length ? '.' : null}
          </p>
        </div>
        {schreiben && objekt ? (
          <Link
            className="knopf"
            href={
              '/dokumente/neu?objekt=' +
              objekt +
              '&zurueck=' +
              encodeURIComponent('/dokumente?objekt=' + objekt)
            }
          >
            Dokument hochladen
          </Link>
        ) : null}
      </div>
      <form
        // Gleiche Route bei anderem Filter: ohne key behielte React die alten Feldwerte
        key={[q, objekt, art, alle ?? ''].join('|')}
        action="/dokumente"
        role="search"
        className="karte filter"
        data-testid="dokument-filter"
      >
        <label>
          <span className="sr-only">Suche</span>
          <span className="suchfeld">
            <Search size={16} aria-hidden />
            <input name="q" type="search" defaultValue={q} placeholder="Titel oder Dateiname" />
          </span>
        </label>
        <label>
          Immobilie
          <select name="objekt" defaultValue={objekt}>
            <option value="">alle Immobilien</option>
            {objekte.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Art
          <select name="art" defaultValue={art}>
            <option value="">alle Arten</option>
            {DOKUMENT_TYPEN.filter((t) => t !== 'beleg').map((t) => (
              <option key={t} value={t}>
                {DOKUMENT_TYP_TEXT[t]}
              </option>
            ))}
          </select>
        </label>
        <label className="zeile">
          <input type="checkbox" name="alle" value="1" defaultChecked={Boolean(alle)} />
          auch ersetzte und abgelaufene
        </label>
        <div className="zeile">
          <button type="submit">Filtern</button>
          {gefiltert ? <Link href="/dokumente">Filter zurücksetzen</Link> : null}
        </div>
      </form>
      {zeilen.length === 0 ? (
        <p className="leise" data-testid="dokumente-leer">
          Dokumente legst du in der Akte eines Hauses oder einer Wohnung oder am Mietverhältnis ab;
          aus dem Posteingang lassen sich Anhänge übernehmen.
        </p>
      ) : sichtbar.length === 0 ? (
        <p className="leise" data-testid="dokumente-leer">
          Kein Dokument passt zum Filter.
        </p>
      ) : (
        <div className="karte">
          <DokumentListe dokumente={sichtbar} />
        </div>
      )}
    </>
  )
}
