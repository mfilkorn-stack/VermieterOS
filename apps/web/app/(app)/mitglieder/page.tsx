import { headers } from 'next/headers'
import { Formular } from '@/components/formular'
import { auth } from '@/lib/auth'
import { istRolle, ROLLEN, ROLLEN_TEXT } from '@/lib/rechte'
import { aktiverMandant, darf } from '@/lib/sitzung'
import { einladen } from '../aktionen'

const BASIS_URL = process.env['BETTER_AUTH_URL'] ?? 'http://localhost:3000'

export default async function MitgliederSeite() {
  await aktiverMandant()
  const org = await auth.api.getFullOrganization({ headers: await headers() })
  const einladenErlaubt = await darf({ invitation: ['create'] })
  const offen = (org?.invitations ?? []).filter((i) => i.status === 'pending')

  return (
    <>
      <h1>Mitglieder · {org?.name}</h1>
      <ul className="liste" data-testid="mitgliederliste">
        {(org?.members ?? []).map((m) => (
          <li key={m.id} className="karte zeile">
            <span>
              <strong>{m.user.name}</strong> <span className="leise">{m.user.email}</span>
            </span>
            <span className="leise">{istRolle(m.role) ? ROLLEN_TEXT[m.role] : m.role}</span>
          </li>
        ))}
      </ul>

      {einladenErlaubt ? (
        <>
          <h2>Einladen</h2>
          <div className="karte">
            <Formular aktion={einladen} knopf="Einladung erstellen" testId="einladen">
              <label>
                E-Mail
                <input name="email" type="email" required />
              </label>
              <label>
                Rolle
                <select name="rolle" defaultValue="mitverwalter">
                  {ROLLEN.map((r) => (
                    <option key={r} value={r}>
                      {ROLLEN_TEXT[r]}
                    </option>
                  ))}
                </select>
              </label>
            </Formular>
          </div>
          {offen.length > 0 ? (
            <>
              <h2>Offene Einladungen</h2>
              <p className="leise">
                Bis der Mailversand steht (Phase 1), den Link selbst weitergeben. Er gilt nur für
                die eingeladene E-Mail-Adresse.
              </p>
              <ul className="liste">
                {offen.map((i) => (
                  <li key={i.id} className="karte">
                    <div>
                      {i.email} ·{' '}
                      {istRolle(i.role ?? '')
                        ? ROLLEN_TEXT[i.role as keyof typeof ROLLEN_TEXT]
                        : i.role}
                    </div>
                    <code data-testid="einladungslink">{`${BASIS_URL}/einladungen/${i.id}`}</code>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      ) : null}
    </>
  )
}
