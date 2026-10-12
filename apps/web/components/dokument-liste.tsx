import type { DokumentZeile } from '@vermieteros/db'
import { FileText, Image as Bild } from 'lucide-react'
import Link from 'next/link'
import { DOKUMENT_STATUS_TEXT, DOKUMENT_TYP_TEXT } from '@/lib/dokument-text'
import { datumAnzeige } from '@/lib/format'
import { Status } from './status'

export function DokumentListe({ dokumente }: { dokumente: DokumentZeile[] }) {
  if (dokumente.length === 0) return <p className="leise">Noch keine Dokumente.</p>
  return (
    <ul className="dateien" data-testid="dokumentliste">
      {dokumente.map((d) => (
        <li key={d.id} className="datei" data-testid="dokument" data-titel={d.titel}>
          {d.mime.startsWith('image/') ? (
            <Bild size={20} strokeWidth={1.75} aria-hidden />
          ) : (
            <FileText size={20} strokeWidth={1.75} aria-hidden />
          )}
          <span className="text">
            <Link href={d.beleg || d.typ === 'beleg' ? `/belege/${d.id}` : `/dokumente/${d.id}`}>
              {d.titel}
            </Link>
            <span className="leise">
              {d.beleg || d.typ === 'beleg' ? 'Beleg' : DOKUMENT_TYP_TEXT[d.typ]}
              {d.dokumentdatum ? ` · ${datumAnzeige(d.dokumentdatum)}` : ''}
            </span>
          </span>
          {d.status === 'gueltig' ? null : (
            <Status ton="neutral">{DOKUMENT_STATUS_TEXT[d.status]}</Status>
          )}
        </li>
      ))}
    </ul>
  )
}
