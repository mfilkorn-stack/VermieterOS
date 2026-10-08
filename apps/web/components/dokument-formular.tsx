import { dokumentHochladen } from '@/app/(app)/dokumente/aktionen'
import { DATEI_ACCEPT } from '@/lib/dokument-text'
import { DokumentArtAuswahl } from './dokument-art-auswahl'
import { Feld } from './felder'
import { Formular } from './formular'

export function DokumentFormular({
  objektId,
  mietverhaeltnisId,
  ersetztId,
  typ,
  zurueck,
}: {
  objektId?: string | undefined
  mietverhaeltnisId?: string | undefined
  ersetztId?: string | undefined
  typ?: string | undefined
  /** Nach dem Upload hierhin statt zum Dokument (z. B. Jahresabschluss) */
  zurueck?: string | undefined
}) {
  return (
    <Formular aktion={dokumentHochladen} knopf="Hochladen" testId="dokument-hochladen">
      {objektId ? <input type="hidden" name="objektId" value={objektId} /> : null}
      {mietverhaeltnisId ? (
        <input type="hidden" name="mietverhaeltnisId" value={mietverhaeltnisId} />
      ) : null}
      {ersetztId ? <input type="hidden" name="ersetztId" value={ersetztId} /> : null}
      {zurueck ? <input type="hidden" name="zurueck" value={zurueck} /> : null}
      <label>
        Datei (PDF, JPG, PNG, WebP, HEIC; bis 20 MB)
        <input type="file" name="datei" accept={DATEI_ACCEPT} required />
      </label>
      <div className="zeile">
        <DokumentArtAuswahl
          defaultValue={typ ?? (mietverhaeltnisId ? 'mietvertrag' : 'sonstiges')}
        />
        <Feld label="Titel" name="titel" placeholder="ohne Angabe: Dateiname" />
      </div>
      <div className="zeile">
        <Feld label="Datum des Dokuments" name="dokumentdatum" type="date" />
        <Feld
          label="Gültig bis"
          name="gueltigBis"
          type="date"
          hinweis="z. B. Versicherung, Befristung"
        />
      </div>
      <label>
        Notizen
        <textarea name="notizen" rows={2} />
      </label>
    </Formular>
  )
}
