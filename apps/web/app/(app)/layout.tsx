import Link from 'next/link'
import type { ReactNode } from 'react'
import { erfordereGesicherteSitzung } from '@/lib/sitzung'
import { abmelden } from '../(oeffentlich)/aktionen'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const s = await erfordereGesicherteSitzung()
  return (
    <>
      <header className="kopf">
        <Link href="/">
          <strong>Vermieter.OS</strong>
        </Link>
        <nav>
          <Link href="/mandanten">Mandanten</Link>
          <Link href="/eigentuemer">Eigentümer</Link>
          <Link href="/mitglieder">Mitglieder</Link>
          <Link href="/sicherheit">Sicherheit</Link>
          <span className="leise">{s.user.name}</span>
          <form action={abmelden}>
            <button type="submit" className="zweit">
              Abmelden
            </button>
          </form>
        </nav>
      </header>
      <main>{children}</main>
    </>
  )
}
