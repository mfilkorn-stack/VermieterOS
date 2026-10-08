'use client'

import { Building, Check, ExternalLink, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import type { Firma, Kontakt } from '@/lib/firma'

function zeile(f: Firma): string {
  const a = f.adresse
  return a
    ? f.name + ', ' + [a.strasse, a.hausnummer].filter(Boolean).join(' ') + ', ' + a.ort
    : f.name
}

/**
 * Firmensuche über dem Handwerker-Formular: Vorschläge aus OpenStreetMap beim Tippen, die
 * Auswahl füllt Firma, Anschrift und Gewerk sowie leere Felder für Telefon, E-Mail und Webseite.
 * Für Betriebe, die nicht in OpenStreetMap stehen, öffnet „Im Internet suchen“ eine Websuche
 * im eigenen Browser. Das Suchfeld hat keinen Namen und wird nicht mitgeschickt.
 */
export function Firmensuche() {
  const [text, setText] = useState('')
  const [treffer, setTreffer] = useState<Firma[]>([])
  const [offen, setOffen] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const [status, setStatus] = useState<'leer' | 'fehler' | 'keine'>('leer')
  const [gewaehlt, setGewaehlt] = useState<{ firma: Firma; kontakt: Kontakt | null } | null>(null)
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
      try {
        const r = await fetch('/api/firmen?q=' + encodeURIComponent(q), { signal: abbruch.signal })
        const j = (await r.json()) as { treffer: Firma[] }
        if (!r.ok) throw new Error(String(r.status))
        setTreffer(j.treffer)
        setAktiv(0)
        setOffen(true)
        setStatus(j.treffer.length ? 'leer' : 'keine')
      } catch {
        if (!abbruch.signal.aborted) setStatus('fehler')
      }
    }, 300)
    return () => {
      clearTimeout(zeit)
      abbruch.abort()
    }
  }, [text])

  async function uebernehmen(f: Firma) {
    const form = eingabe.current?.closest('form')
    if (!form) return
    const feld = (n: string) => form.elements.namedItem(n) as HTMLInputElement | null
    const setze = (n: string, wert: string | null | undefined, nurLeer = false) => {
      const el = feld(n)
      if (el && wert && !(nurLeer && el.value.trim())) el.value = wert
    }
    setze('firma', f.name)
    if (f.adresse) {
      setze('strasse', f.adresse.strasse)
      setze('hausnummer', f.adresse.hausnummer ?? '')
      setze('plz', f.adresse.plz)
      setze('ort', f.adresse.ort)
    }
    if (f.gewerk) {
      const haken = form.querySelector<HTMLInputElement>(
        'input[name="gewerke"][value="' + f.gewerk + '"]',
      )
      if (haken) haken.checked = true
    }
    setOffen(false)
    setText('')
    setGewaehlt({ firma: f, kontakt: null })
    try {
      const r = await fetch('/api/firmen/kontakt?osm=' + encodeURIComponent(f.osm))
      const j = (await r.json()) as { kontakt: Kontakt | null }
      if (j.kontakt) {
        // Vorhandene Eingaben bleiben: nur leere Felder werden gefüllt.
        setze('telefon', j.kontakt.telefon, true)
        setze('email', j.kontakt.email, true)
        setze('webseite', j.kontakt.webseite, true)
      }
      setGewaehlt({ firma: f, kontakt: j.kontakt })
    } catch {
      // Kontaktdaten sind eine Zugabe; ohne sie bleibt die Auswahl gültig.
    }
  }

  function taste(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') e.preventDefault()
    if (!offen || treffer.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAktiv((i) => (i + 1) % treffer.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setAktiv((i) => (i - 1 + treffer.length) % treffer.length)
    } else if (e.key === 'Enter') {
      void uebernehmen(treffer[aktiv]!)
    } else if (e.key === 'Escape') {
      setOffen(false)
    }
  }

  const websuche =
    'https://www.google.com/search?q=' +
    encodeURIComponent(text.trim() || (gewaehlt ? zeile(gewaehlt.firma) : ''))

  return (
    <div className="adresssuche" data-testid="firmensuche">
      <label>
        Firma suchen
        <input
          ref={eingabe}
          type="search"
          role="combobox"
          aria-expanded={offen && treffer.length > 0}
          aria-controls={listeId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="z. B. Elektro Muster Musterstadt"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={taste}
          onBlur={() => setTimeout(() => setOffen(false), 150)}
          onFocus={() => treffer.length && setOffen(true)}
        />
      </label>
      {offen && treffer.length > 0 ? (
        <ul id={listeId} role="listbox" className="adresssuche-liste">
          {treffer.map((f, i) => (
            <li
              key={f.osm}
              role="option"
              aria-selected={i === aktiv}
              onMouseDown={(e) => {
                e.preventDefault()
                void uebernehmen(f)
              }}
              onMouseMove={() => setAktiv(i)}
            >
              <Building size={14} aria-hidden />
              <span>{zeile(f)}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="leise firmensuche-fuss">
        {status === 'fehler' ? (
          <>
            <TriangleAlert size={14} aria-hidden /> Firmensuche gerade nicht erreichbar.{' '}
          </>
        ) : status === 'keine' ? (
          'Nicht in OpenStreetMap gefunden. '
        ) : gewaehlt ? (
          <span className="adresse-ok" data-testid="firma-gefunden">
            <Check size={14} aria-hidden /> Übernommen aus OpenStreetMap
            {gewaehlt.kontakt?.telefon || gewaehlt.kontakt?.email || gewaehlt.kontakt?.webseite
              ? ', Kontaktdaten bitte prüfen. '
              : '. '}
          </span>
        ) : (
          'Vorschläge aus OpenStreetMap. '
        )}
        <a href={websuche} target="_blank" rel="noopener noreferrer" data-testid="websuche">
          Im Internet suchen <ExternalLink size={12} aria-hidden />
        </a>
      </span>
    </div>
  )
}
