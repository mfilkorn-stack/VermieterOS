/** Läuft einmal beim Serverstart (Next.js). Ergebnis nur im Log, der Start wartet nicht darauf. */
export async function register() {
  if (process.env['NEXT_RUNTIME'] !== 'nodejs') return
  const { pruefeMailVersand } = await import('./lib/mail')
  void pruefeMailVersand().then(({ ok, meldung }) => {
    if (ok) console.log(`[mail] SMTP ${meldung}`)
    else if (process.env.NODE_ENV === 'production') console.error(`[mail] SMTP ${meldung}`)
    else console.log(`[mail] SMTP ${meldung}; Mails stehen im Server-Log`)
  })
}
