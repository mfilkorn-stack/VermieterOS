import { listeHandwerker } from '@vermieteros/db'
import { Globe, HardHat, Mail, MapPin, Phone, Plus, Siren, Star } from 'lucide-react'
import Link from 'next/link'
import { Status } from '@/components/status'
import { GEWERK_TEXT } from '@/lib/betrieb-text'
import { darf, mitMandant } from '@/lib/sitzung'

export default async function HandwerkerSeite() {
  const liste = await mitMandant((tx) => listeHandwerker(tx))
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Handwerker</h1>
          <p className="leise">Verzeichnis für Aufträge und die Notfallkarten der Objekte.</p>
        </div>
        {schreiben ? (
          <Link className="knopf" href="/handwerker/neu" data-testid="handwerker-neu">
            <Plus size={18} aria-hidden />
            Handwerker anlegen
          </Link>
        ) : null}
      </div>
      {liste.length === 0 ? (
        <p className="leise" data-testid="handwerker-leer">
          Noch keine Handwerker erfasst.{' '}
          {schreiben ? (
            <Link href="/handwerker/neu">Ersten Handwerker anlegen</Link>
          ) : (
            'Sie erscheinen auf der Notfallkarte und bei Tickets.'
          )}
        </p>
      ) : null}
      <ul className="liste" data-testid="handwerkerliste">
        {liste.map((h) => (
          <li key={h.id} className="karte objektkarte">
            <div className="objektkarte-kopf">
              <span className="icon-kachel">
                <HardHat size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="objektkarte-titel">
                {schreiben ? (
                  <Link href={`/handwerker/${h.id}`}>
                    <strong>{h.firma}</strong>
                  </Link>
                ) : (
                  <strong>{h.firma}</strong>
                )}
                <span className="meta">
                  <span>{h.gewerke.map((g) => GEWERK_TEXT[g]).join(', ')}</span>
                  {h.ansprechpartner ? <span>{h.ansprechpartner}</span> : null}
                </span>
              </span>
              {h.bewertung ? (
                <span className="meta" title="Bewertung">
                  <Star size={15} aria-hidden />
                  {h.bewertung}/5
                </span>
              ) : null}
            </div>
            <p className="meta">
              {h.notdienst ? (
                <Status ton="gelb" icon={Siren}>
                  Notdienst
                </Status>
              ) : null}
              {h.telefon ? (
                <a href={`tel:${h.telefon.replace(/[^+\d]/g, '')}`}>
                  <Phone size={14} aria-hidden /> {h.telefon}
                </a>
              ) : null}
              {h.notdienstTelefon ? (
                <a href={`tel:${h.notdienstTelefon.replace(/[^+\d]/g, '')}`}>
                  <Siren size={14} aria-hidden /> {h.notdienstTelefon}
                </a>
              ) : null}
              {h.email ? (
                <a href={`mailto:${h.email}`}>
                  <Mail size={14} aria-hidden /> {h.email}
                </a>
              ) : null}
              {h.webseite ? (
                <a href={h.webseite} target="_blank" rel="noopener noreferrer">
                  <Globe size={14} aria-hidden /> Webseite
                </a>
              ) : null}
              {h.ort ? (
                <span>
                  <MapPin size={14} aria-hidden /> {[h.plz, h.ort].filter(Boolean).join(' ')}
                </span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
