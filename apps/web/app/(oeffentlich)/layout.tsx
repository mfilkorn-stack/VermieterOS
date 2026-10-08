import Link from 'next/link'
import { Building2 } from 'lucide-react'
import type { ReactNode } from 'react'

export default function OeffentlichLayout({ children }: { children: ReactNode }) {
  return (
    <div className="oeffentlich">
      <div className="schmal">
        <div className="marke">
          <span className="marke-zeichen">
            <Building2 size={18} strokeWidth={2} aria-hidden />
          </span>
          <span className="marke-name">Vermieter.OS</span>
        </div>
        <main>{children}</main>
        <p className="leise oeffentlich-fuss">
          <Link href="/datenschutz">Datenschutz</Link>
        </p>
      </div>
    </div>
  )
}
