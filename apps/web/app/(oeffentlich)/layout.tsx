import type { ReactNode } from 'react'

export default function OeffentlichLayout({ children }: { children: ReactNode }) {
  return (
    <main>
      <div className="schmal">
        <p className="leise">Vermieter.OS</p>
        {children}
      </div>
    </main>
  )
}
