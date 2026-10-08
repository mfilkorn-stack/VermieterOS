import Link from 'next/link'
import { DOKUMENT_GRUPPEN, DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'

/**
 * Auswahl der Dokumentart, nach Themen gruppiert. Belege sind keine Dokumentart zur Auswahl:
 * Sie gehören zu den Belegen, wo sie ausgelesen und gebucht werden.
 */
export function DokumentArtAuswahl({ defaultValue }: { defaultValue: string }) {
  return (
    <label>
      Art
      <select name="typ" defaultValue={defaultValue === 'beleg' ? 'sonstiges' : defaultValue}>
        {DOKUMENT_GRUPPEN.map(([gruppe, typen]) => (
          <optgroup key={gruppe} label={gruppe}>
            {typen
              .filter((t) => t !== 'beleg')
              .map((t) => (
                <option key={t} value={t}>
                  {DOKUMENT_TYP_TEXT[t]}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
      <span className="leise">
        Rechnungen und Quittungen als <Link href="/belege">Beleg hochladen</Link>, dann werden sie
        ausgelesen und gebucht.
      </span>
    </label>
  )
}
