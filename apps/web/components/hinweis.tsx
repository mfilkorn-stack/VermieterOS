'use client'

import { CircleCheck } from 'lucide-react'
import { useEffect, useState } from 'react'

/** Einmalige Bestätigung nach einer Aktion; löscht das Cookie und verschwindet nach fünf Sekunden. */
export function Hinweis({ text, cookie }: { text: string; cookie: string }) {
  const [sichtbar, setSichtbar] = useState(true)
  useEffect(() => {
    document.cookie = cookie + '=; Max-Age=0; path=/'
    const t = setTimeout(() => setSichtbar(false), 5000)
    return () => clearTimeout(t)
  }, [cookie])
  if (!sichtbar) return null
  return (
    <div className="hinweis-toast" role="status" data-testid="hinweis">
      <CircleCheck size={16} aria-hidden />
      {text}
    </div>
  )
}
