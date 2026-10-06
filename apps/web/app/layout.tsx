import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  title: 'Vermieter.OS',
  description: 'Verwaltungssoftware für private Vermieter',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body
        style={{ fontFamily: 'system-ui, sans-serif', margin: 0, padding: '2rem', maxWidth: 720 }}
      >
        {children}
      </body>
    </html>
  )
}
