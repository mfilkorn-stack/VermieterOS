import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'

export const metadata = { title: 'Mieterportal · Vermieter.OS' }

/** Eigene, schlichte Hülle für Mieter: keine Navigation der Verwaltung, mobil zuerst. */
export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="oeffentlich portal">
      <div className="schmal">
        <div className="marke">
          <span className="marke-zeichen">
            <Building2 size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="marke-name">Mieterportal</span>
        </div>
        <main>{children}</main>
      </div>
    </div>
  )
}
