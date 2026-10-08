import { FileSearch } from 'lucide-react'
import Link from 'next/link'

/**
 * Hinweis in den Schritten Kauf und Stammdaten: Kaufvertrag hochladen oder öffnen, die KI liest
 * Daten, Kaufpreis und Grundbuch aus, übernommen wird nach Prüfung auf der Dokumentseite.
 */
export function AusKaufvertrag({
  objektId,
  kaufvertrag,
}: {
  objektId: string
  kaufvertrag: { id: string; titel: string } | null
}) {
  return (
    <p className="hinweis-box" data-testid="aus-kaufvertrag">
      <FileSearch size={16} aria-hidden />
      <span>
        {kaufvertrag ? (
          <>
            Werte aus dem Kaufvertrag übernehmen:{' '}
            <Link href={'/dokumente/' + kaufvertrag.id}>
              {kaufvertrag.titel} öffnen und auslesen
            </Link>
          </>
        ) : (
          <>
            Kaufvertrag als PDF hochladen, dann liest die KI Datum, Kaufpreis und Grundbuch aus:{' '}
            <Link href={'/dokumente/neu?objekt=' + objektId + '&typ=kaufvertrag'}>
              Kaufvertrag hochladen
            </Link>
          </>
        )}
      </span>
    </p>
  )
}
