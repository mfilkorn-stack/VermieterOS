import Link from 'next/link'

/** Kurzer Hinweis an jeder Stelle, an der Inhalte an die KI gehen (Art. 13 DSGVO). */
export function KiHinweis({ was }: { was: string }) {
  return (
    <p className="leise ki-hinweis" data-testid="ki-hinweis">
      {was} geht dafür an Anthropic (USA, Auftragsverarbeitung, kein Training mit diesen Daten). Das
      Ergebnis ist ein Vorschlag, entschieden wird von Hand.{' '}
      <Link href="/datenschutz">Datenschutz</Link>
    </p>
  )
}
