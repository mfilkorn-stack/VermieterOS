import Link from 'next/link'
import { Formular } from '@/components/formular'
import { verlangePortal } from '@/lib/portal'
import { mangelMelden } from '../aktionen'

export default async function PortalMangel() {
  await verlangePortal()
  return (
    <div className="karte">
      <p className="leise">
        <Link href="/portal">Zurück</Link>
      </p>
      <h1>Mangel melden</h1>
      <p className="leise">
        Bei Gefahr (Wasserrohrbruch, Gasgeruch, Stromausfall) bitte sofort die Nummern unter „Im
        Notfall“ anrufen. Diese Meldung liest Ihr Vermieter, aber nicht rund um die Uhr.
      </p>
      <Formular aktion={mangelMelden} knopf="Meldung absenden" testId="portal-mangel-formular">
        <label>
          Was ist kaputt?
          <input
            name="titel"
            maxLength={200}
            required
            placeholder="z. B. Heizung im Bad bleibt kalt"
          />
        </label>
        <label>
          Beschreibung
          <textarea
            name="beschreibung"
            rows={5}
            placeholder="Seit wann, wo genau, was haben Sie schon versucht?"
          />
        </label>
        <label>
          Fotos (bis zu 5, JPG, PNG oder WebP)
          <input name="fotos" type="file" accept="image/jpeg,image/png,image/webp" multiple />
        </label>
        <label className="haken">
          <input type="checkbox" name="dringend" value="1" /> Dringend (Wohnung nur eingeschränkt
          nutzbar)
        </label>
      </Formular>
    </div>
  )
}
