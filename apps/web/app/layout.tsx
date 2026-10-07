import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
// Schrift selbst gehostet (DSGVO): kein Abruf bei Google, Dateien kommen aus dem Build.
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-sans/latin-700.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import './globals.css'

export const metadata: Metadata = {
  title: 'Vermieter.OS',
  description: 'Verwaltungssoftware für private Vermieter',
}

export const viewport: Viewport = {
  themeColor: '#0f2a31',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  )
}
