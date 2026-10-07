import { DOKUMENT_GRUPPEN, DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'

/** Auswahl der Dokumentart, nach Themen gruppiert. */
export function DokumentArtAuswahl({ defaultValue }: { defaultValue: string }) {
  return (
    <label>
      Art
      <select name="typ" defaultValue={defaultValue}>
        {DOKUMENT_GRUPPEN.map(([gruppe, typen]) => (
          <optgroup key={gruppe} label={gruppe}>
            {typen.map((t) => (
              <option key={t} value={t}>
                {DOKUMENT_TYP_TEXT[t]}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  )
}
