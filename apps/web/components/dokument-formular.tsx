import { DOKUMENT_TYPEN } from '@vermieteros/schema'
import { dokumentHochladen } from '@/app/(app)/dokumente/aktionen'
import { DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'
import { Auswahl, Feld } from './felder'
import { Formular } from './formular'

export function DokumentFormular({
  objektId,
  mietverhaeltnisId,
  ersetztId,
  typ,
}: {
  objektId?: string | undefined
  mietverhaeltnisId?: string | undefined
  ersetztId?: string | undefined
  typ?: string | undefined
}) {
  return (
    <Formular aktion={dokumentHochladen} knopf="Hochladen" testId="dokument-hochladen">
      {objektId ? <input type="hidden" name="objektId" value={objektId} /> : null}
      {mietverhaeltnisId ? (
        <input type="hidden" name="mietverhaeltnisId" value={mietverhaeltnisId} />
      ) : null}
      {ersetztId ? <input type="hidden" name="ersetztId" value={ersetztId} /> : null}
      <label>
        Datei (PDF, JPG, PNG; bis 20 MB)
        <input
          type="file"
          name="datei"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <div className="zeile">
        <Auswahl
          label="Art"
          name="typ"
          optionen={DOKUMENT_TYPEN.map((t) => [t, DOKUMENT_TYP_TEXT[t]] as const)}
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
