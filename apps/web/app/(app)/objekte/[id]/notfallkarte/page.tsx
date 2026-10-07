import { ladeNotfallkarte, letzteVersion, listeHandwerker } from '@vermieteros/db'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Formular } from '@/components/formular'
import { NotfallkarteEditor } from '@/components/notfallkarte-editor'
import { NOTFALL_TEXT, optionen } from '@/lib/betrieb-text'
import { darf, mitMandant } from '@/lib/sitzung'
import { notfallkarteSpeichern } from '../betrieb-aktionen'

export default async function NotfallkarteSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!(await darf({ stammdaten: ['schreiben'] }))) redirect(`/objekte/${id}`)
  const daten = await mitMandant(async (tx) => {
    const o = await letzteVersion(tx, 'objekt', id)
    if (!o) return null
    return {
      objekt: o.bezeichnung,
      karte: await ladeNotfallkarte(tx, id),
      handwerker: (await listeHandwerker(tx)).filter(
        (h) => h.objektIds.length === 0 || h.objektIds.includes(id),
      ),
    }
  })
  if (!daten) notFound()
  return (
    <>
      <nav className="brotkrumen" aria-label="Pfad">
        <Link href={`/objekte/${id}`}>{daten.objekt}</Link>
        <span aria-hidden>/</span>
        <span>Notfallkarte</span>
      </nav>
      <div className="karte">
        <h1>Notfallkarte</h1>
        <p className="leise">
          Wen Mieter im Notfall anrufen. Steht im Mieterportal und fließt in Antwortentwürfe der KI
          ein; die Telefonnummern setzt die Software selbst ein.
        </p>
        <Formular aktion={notfallkarteSpeichern} knopf="Speichern" testId="notfallkarte">
          <input type="hidden" name="objektId" value={id} />
          <NotfallkarteEditor
            name="eintraege"
            arten={optionen(NOTFALL_TEXT)}
            handwerker={daten.handwerker.map((h) => ({ id: h.id, firma: h.firma }))}
            anfang={(daten.karte?.eintraege ?? []).map((e) => ({
              art: e.art,
              handwerkerId: e.handwerkerId ?? '',
              name: e.name ?? '',
              telefon: e.telefon ?? '',
              hinweis: e.hinweis ?? '',
            }))}
          />
        </Formular>
      </div>
    </>
  )
}
