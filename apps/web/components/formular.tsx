'use client'

import { startTransition, useActionState, type FormEvent, type ReactNode } from 'react'
import type { FormStatus } from '@/lib/form-status'

/**
 * Formular mit Server Action, Fehlermeldung und gesperrtem Knopf während des Sendens.
 * Bewusst ohne automatisches Zurücksetzen: Bei einem Fehler bleiben alle Eingaben stehen.
 */
export function Formular({
  aktion,
  knopf,
  children,
  testId,
  zweit,
}: {
  aktion: (vorher: FormStatus, daten: FormData) => Promise<FormStatus>
  knopf: string
  children: ReactNode
  testId?: string
  /** Zweitrangige Aktion (Verwerfen, Abbrechen): heller Knopf */
  zweit?: boolean
}) {
  const [status, formAktion, laeuft] = useActionState(aktion, {})
  function absenden(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const daten = new FormData(e.currentTarget)
    startTransition(() => formAktion(daten))
  }
  return (
    <form onSubmit={absenden} data-testid={testId}>
      {children}
      {status.fehler ? (
        <p role="alert" className="fehler">
          {status.fehler}
        </p>
      ) : null}
      {status.hinweis ? <p className="leise">{status.hinweis}</p> : null}
      <button type="submit" disabled={laeuft} className={zweit ? 'zweit' : undefined}>
        {knopf}
      </button>
    </form>
  )
}
