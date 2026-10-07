'use client'

import { CircleCheck, Copy, LoaderCircle, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { HochladenErgebnis } from '@/app/(app)/belege/aktionen'

type Zustand = {
  name: string
  stand: 'wartet' | 'laedt' | 'liest' | 'fertig' | 'doppelt' | 'fehler'
  id?: string
  text?: string
}

/**
 * Sammel-Import (WP 1.8): Ordner mit PDFs und Fotos reinziehen. Jede Datei geht einzeln hoch
 * (keine Größengrenze für den ganzen Stapel) und wird danach ausgelesen, wenn die KI läuft.
 * Bricht eine Datei ab, laufen die übrigen weiter.
 */
export function BelegImport({
  hochladen,
  auslesen,
  ki,
  objekte,
  ticketId,
}: {
  hochladen: (d: FormData) => Promise<HochladenErgebnis>
  auslesen: (id: string) => Promise<{ fehler?: string }>
  ki: boolean
  objekte?: { id: string; bezeichnung: string }[]
  ticketId?: string
}) {
  const router = useRouter()
  const [liste, setListe] = useState<Zustand[]>([])
  const [laeuft, setLaeuft] = useState(false)

  async function starte(form: HTMLFormElement) {
    const eingabe = form.elements.namedItem('dateien') as HTMLInputElement
    const objektId = (form.elements.namedItem('objektId') as HTMLSelectElement | null)?.value ?? ''
    const dateien = Array.from(eingabe.files ?? [])
    if (dateien.length === 0) return
    setLaeuft(true)
    setListe(dateien.map((f) => ({ name: f.name, stand: 'wartet' })))
    const setze = (i: number, z: Partial<Zustand>) =>
      setListe((alt) => alt.map((x, j) => (j === i ? { ...x, ...z } : x)))
    for (const [i, f] of dateien.entries()) {
      setze(i, { stand: 'laedt' })
      const d = new FormData()
      d.set('datei', f)
      if (objektId) d.set('objektId', objektId)
      if (ticketId) d.set('ticketId', ticketId)
      const r = await hochladen(d).catch(
        (e: unknown) => ({ fehler: String(e) }) as HochladenErgebnis,
      )
      if (r.fehler || !r.id) {
        setze(i, { stand: 'fehler', text: r.fehler ?? 'Unbekannter Fehler' })
        continue
      }
      if (r.doppelt) {
        setze(i, { stand: 'doppelt', id: r.id, text: 'schon im Eingang' })
        continue
      }
      if (ki) {
        setze(i, { stand: 'liest', id: r.id })
        const a = await auslesen(r.id).catch((e: unknown) => ({ fehler: String(e) }))
        setze(i, {
          stand: 'fertig',
          id: r.id,
          text: a.fehler ? `abgelegt, nicht ausgelesen: ${a.fehler}` : 'abgelegt und ausgelesen',
        })
      } else {
        setze(i, { stand: 'fertig', id: r.id, text: 'abgelegt' })
      }
    }
    eingabe.value = ''
    setLaeuft(false)
    router.refresh()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void starte(e.currentTarget)
      }}
      data-testid="beleg-import"
    >
      <label>
        Dateien (PDF, JPG, PNG, WebP; je bis 20 MB)
        <input
          type="file"
          name="dateien"
          multiple
          accept="application/pdf,image/jpeg,image/png,image/webp"
          required
        />
      </label>
      {objekte && objekte.length > 0 ? (
        <label>
          Objekt, falls schon klar
          <select name="objektId" defaultValue="">
            <option value="">erst beim Buchen</option>
            {objekte.map((o) => (
              <option key={o.id} value={o.id}>
                {o.bezeichnung}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button type="submit" disabled={laeuft}>
        {laeuft ? 'Lädt hoch …' : ki ? 'Hochladen und auslesen' : 'Hochladen'}
      </button>
      {liste.length > 0 ? (
        <ul className="import-liste" data-testid="import-liste">
          {liste.map((z, i) => (
            <li key={i} data-stand={z.stand}>
              {z.stand === 'fertig' ? (
                <CircleCheck size={14} aria-hidden color="var(--gruen)" />
              ) : z.stand === 'fehler' ? (
                <TriangleAlert size={14} aria-hidden color="var(--rot)" />
              ) : z.stand === 'doppelt' ? (
                <Copy size={14} aria-hidden />
              ) : (
                <LoaderCircle size={14} aria-hidden />
              )}{' '}
              {z.id ? <Link href={`/belege/${z.id}`}>{z.name}</Link> : z.name}
              <span className="leise">
                {' '}
                {z.text ??
                  (z.stand === 'laedt'
                    ? 'lädt hoch'
                    : z.stand === 'liest'
                      ? 'wird ausgelesen'
                      : 'wartet')}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </form>
  )
}
