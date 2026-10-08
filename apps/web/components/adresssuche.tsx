'use client'

import { Check, MapPin, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Adresse } from '@/lib/adresse'

const FELDER = ['strasse', 'hausnummer', 'plz', 'ort'] as const

function anzeige(a: Adresse): string {
  return [a.strasse, a.hausnummer].filter(Boolean).join(' ') + ', ' + a.plz + ' ' + a.ort
}

/**
 * Suchfeld über den Adressfeldern eines Formulars: Vorschläge beim Tippen, Auswahl füllt
 * Straße, Hausnummer, PLZ, Ort und (falls vorhanden) Bundesland. Die Felder bleiben normal
 * bearbeitbar; weicht man danach ab, sagt der Hinweis das. Das Suchfeld selbst hat keinen
 * Namen und wird nicht mitgeschickt.
 */
export function Adresssuche() {
  const [text, setText] = useState('')
  const [treffer, setTreffer] = useState<Adresse[]>([])
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const [status, setStatus] = useState<'leer' | 'laeuft' | 'fehler' | 'keine'>('leer')
  const [gewaehlt, setGewaehlt] = useState<Adresse | null>(null)
  const [abweichend, setAbweichend] = useState(false)
  const eingabe = useRef<HTMLInputElement>(null)
  const listeId = useId()

  useEffect(() => {
    const q = text.trim()
    if (q.length < 3) {
      setTreffer([])
      setStatus('leer')
      return
    }
    const abbruch = new AbortController()
    const zeit = setTimeout(async () => {
      setStatus('laeuft')
      try {
        const r = await fetch('/api/adressen?q=' + encodeURIComponent(q), {
          signal: abbruch.signal,
        })
        const j = (await r.json()) as { treffer: Adresse[] }
        if (!r.ok) throw new Error(String(r.status))
        setTreffer(j.treffer)
        setAktiv(0)
        setOffen(true)
        setStatus(j.treffer.length ? 'leer' : 'keine')
      } catch {
        if (!abbruch.signal.aborted) setStatus('fehler')
      }
    }, 250)
    return () => {
      clearTimeout(zeit)
      abbruch.abort()
    }
  }, [text])

  // Abweichung von der gewählten Anschrift erkennen, solange eine gewählt ist.
  useEffect(() => {
    const form = eingabe.current?.closest('form')
    if (!form || !gewaehlt) return
    const pruefe = () => {
      const feld = (n: string) =>
        (form.elements.namedItem(n) as HTMLInputElement | null)?.value.trim() ?? ''
      setAbweichend(
        feld('strasse') !== gewaehlt.strasse ||
          feld('plz') !== gewaehlt.plz ||
          feld('ort') !== gewaehlt.ort ||
          (gewaehlt.hausnummer != null && feld('hausnummer') !== gewaehlt.hausnummer),
      )
    }
    form.addEventListener('input', pruefe)
    return () => form.removeEventListener('input', pruefe)
  }, [gewaehlt])

  function uebernehmen(a: Adresse) {
    const form = eingabe.current?.closest('form')
    if (!form) return
    const setze = (n: string, wert: string) => {
      const el = form.elements.namedItem(n) as HTMLInputElement | HTMLSelectElement | null
      if (el) el.value = wert
    }
    for (const f of FELDER) setze(f, a[f] ?? '')
    if (a.bundesland) setze('bundesland', a.bundesland)
    setGewaehlt(a)
    setAbweichend(false)
    setOffen(false)
    setText('')
    // Straße ohne Hausnummer gefunden: Nummer gleich eingeben lassen.
    if (!a.hausnummer) (form.elements.namedItem('hausnummer') as HTMLInputElement | null)?.focus()
  }

  function taste(e: KeyboardEvent<HTMLInputElement>) {
    // Enter im Suchfeld schickt nie das Formular ab.
    if (e.key === 'Enter') e.preventDefault()
    if (!offen || treffer.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAktiv((i) => (i + 1) % treffer.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktiv((i) => (i - 1 + treffer.length) % treffer.length)
    } else if (e.key === 'Enter') {
      uebernehmen(treffer[aktiv]!)
    } else if (e.key === 'Escape') {
      setOffen(false)
    }
  }

  return (
    <div className="adresssuche" data-testid="adresssuche">
      <label>
        Adresse suchen
        <input
          ref={eingabe}
          type="search"
          role="combobox"
          aria-expanded={offen && treffer.length > 0}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Straße, Hausnummer, Ort"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={taste}
          onBlur={() => setTimeout(() => setOffen(false), 150)}
          onFocus={() => treffer.length && setOffen(true)}
        />
      </label>
      {offen && treffer.length > 0 ? (
        <ul id={listeId} role="listbox" className="adresssuche-liste">
          {treffer.map((a, i) => (
            <li
              key={anzeige(a)}
              role="option"
              aria-selected={i === aktiv}
              onMouseDown={(e) => {
                e.preventDefault()
                uebernehmen(a)
              }}
              onMouseMove={() => setAktiv(i)}
            >
              <MapPin size={14} aria-hidden />
              <span>{anzeige(a)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {status === 'fehler' ? (
        <span className="leise">
          Adresssuche gerade nicht erreichbar, bitte von Hand ausfüllen.
        </span>
      ) : status === 'keine' ? (
        <span className="leise">Keine Anschrift gefunden.</span>
      ) : gewaehlt && !abweichend ? (
        <span className="adresse-ok" data-testid="adresse-geprueft">
          <Check size={14} aria-hidden /> Anschrift gefunden (OpenStreetMap)
          {gewaehlt.hausnummer ? '' : ', Hausnummer ergänzen'}
        </span>
      ) : gewaehlt && abweichend ? (
        <span className="adresse-abweichend" data-testid="adresse-abweichend">
          <TriangleAlert size={14} aria-hidden /> Von der gefundenen Anschrift abweichend geändert
        </span>
      ) : (
        <span className="leise">
          Wählt man einen Vorschlag, werden die Felder darunter ausgefüllt.
        </span>
      )}
    </div>
  )
}
