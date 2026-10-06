import { headers } from 'next/headers'
import Link from 'next/link'
import { Formular } from '@/components/formular'
import { auth } from '@/lib/auth'
import { fehlertext } from '@/lib/form-status'
import { istRolle, ROLLEN_TEXT } from '@/lib/rechte'
import { erfordereGesicherteSitzung } from '@/lib/sitzung'
import { einladungAnnehmen } from './aktionen'

export default async function EinladungSeite({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const s = await erfordereGesicherteSitzung(`/einladungen/${id}`)

  if (!s.user.emailVerified) {
    return (
      <main>
        <div className="schmal karte" data-testid="einladung-email-unbestaetigt">
          <h1>Einladung</h1>
          <p>
            Einladungen gelten für eine bestimmte E-Mail-Adresse. Bitte zuerst deine Adresse
            bestätigen, dann diesen Link erneut öffnen.
          </p>
          <Link
            className="knopf"
            href={`/sicherheit?weiter=${encodeURIComponent(`/einladungen/${id}`)}`}
          >
            E-Mail bestätigen
          </Link>
        </div>
      </main>
    )
  }

  let einladung: Awaited<ReturnType<typeof auth.api.getInvitation>> | null = null
  let fehler: string | null = null
  try {
    einladung = await auth.api.getInvitation({ query: { id }, headers: await headers() })
  } catch (e) {
    fehler = fehlertext(e)
  }

  return (
    <main>
      <div className="schmal karte">
        <h1>Einladung</h1>
        {einladung ? (
          <>
            <p>
              <strong>{einladung.inviterEmail}</strong> lädt dich in den Mandanten{' '}
              <strong>{einladung.organizationName}</strong> ein, als{' '}
              {istRolle(einladung.role) ? ROLLEN_TEXT[einladung.role] : einladung.role}.
            </p>
            <Formular aktion={einladungAnnehmen} knopf="Annehmen" testId="einladung-annehmen">
              <input type="hidden" name="id" value={id} />
            </Formular>
          </>
        ) : (
          <>
            <p className="fehler">{fehler}</p>
            <Link href="/">Zur Übersicht</Link>
          </>
        )}
      </div>
    </main>
  )
}
