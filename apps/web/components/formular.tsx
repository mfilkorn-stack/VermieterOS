'use client'

import { useActionState, type ReactNode } from 'react'
import type { FormStatus } from '@/lib/form-status'

/** Formular mit Server Action, Fehlermeldung und gesperrtem Knopf während des Sendens. */
export function Formular({
  aktion,
  knopf,
  children,
  testId,
}: {
  aktion: (vorher: FormStatus, daten: FormData) => Promise<FormStatus>
  knopf: string
  children: ReactNode
  testId?: string
}) {
  const [status, formAktion, laeuft] = useActionState(aktion, {})
  return (
    <form action={formAktion} data-testid={testId}>
      {children}
      {status.fehler ? (
        <p role="alert" className="fehler">
          {status.fehler}
        </p>
      ) : null}
      <button type="submit" disabled={laeuft}>
        {knopf}
      </button>
    </form>
  )
}
