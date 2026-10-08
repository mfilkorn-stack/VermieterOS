import Link from 'next/link'
import { Formular } from '@/components/formular'
import { Phone } from 'lucide-react'
import { mitPortal, verlangePortal } from '@/lib/portal'
import { portalUebersicht } from '@/lib/portal-daten'
import { NOTFALL_TEXT } from '@/lib/betrieb-text'
import { mangelMelden } from '../aktionen'

export default async function PortalMangel() {
  await verlangePortal()
  const u = await mitPortal((tx, s) => portalUebersicht(tx, s))
  const notfall = u?.notfall ?? []
  return (
    <div className="karte">
      <p className="leise">
        <Link href="/portal">Zurück</Link>
      </p>
      <h1>Mangel melden</h1>
      <p className="leise">
        Bei Gefahr (Wasserrohrbruch, Gasgeruch, Stromausfall) bitte sofort anrufen. Diese Meldung
        liest Ihr Vermieter, aber nicht rund um die Uhr.
      </p>
      {notfall.length ? (
        <ul className="liste-schlicht notfall" data-testid="mangel-notfall">
          {notfall.map((z, i) => (
            <li key={i}>
              <strong>{NOTFALL_TEXT[z.art]}</strong>: {z.name}
              {z.telefon ? (
                <>
                  {' '}
                  <a href={`tel:${z.telefon.replace(/[^\d+]/g, '')}`}>
                    <Phone size={14} aria-hidden /> {z.telefon}
                  </a>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="leise">
          Notfallnummern sind noch nicht hinterlegt; im Notfall den Vermieter direkt anrufen.
        </p>
      )}
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
          Fotos (bis zu 5, JPG, PNG, WebP oder HEIC)
          <input
            name="fotos"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif"
            multiple
          />
        </label>
        <label className="haken">
          <input type="checkbox" name="dringend" value="1" /> Dringend (Wohnung nur eingeschränkt
          nutzbar)
        </label>
      </Formular>
    </div>
  )
}
