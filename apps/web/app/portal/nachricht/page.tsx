import Link from 'next/link'
import { Formular } from '@/components/formular'
import { verlangePortal } from '@/lib/portal'
import { nachrichtSenden } from '../aktionen'

export default async function PortalNachricht() {
  await verlangePortal()
  return (
    <div className="karte">
      <p className="leise">
        <Link href="/portal">Zurück</Link>
      </p>
      <h1>Nachricht an den Vermieter</h1>
      <Formular
        aktion={nachrichtSenden}
        knopf="Nachricht senden"
        testId="portal-nachricht-formular"
      >
        <label>
          Betreff
          <input name="betreff" maxLength={200} required />
        </label>
        <label>
          Nachricht
          <textarea name="text" rows={8} maxLength={5000} required />
        </label>
      </Formular>
    </div>
  )
}
