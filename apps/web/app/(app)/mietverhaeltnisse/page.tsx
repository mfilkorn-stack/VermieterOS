import { listeMietverhaeltnisse } from '@vermieteros/db'
import { Contact, Mail, Phone, Search } from 'lucide-react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { datumAnzeige, euroAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

function passt(
  z: { mieterNamen: string[]; mieterEmails: string[]; einheit: string; objekt: string },
  q: string,
) {
  const s = q.toLowerCase()
  return [...z.mieterNamen, ...z.mieterEmails, z.einheit, z.objekt].some((t) =>
    t.toLowerCase().includes(s),
  )
}

/** Mieterliste über alle Objekte (UX-1): Suche, laufende und beendete Mietverhältnisse. */
export default async function MieterSeite({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; alle?: string }>
}) {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const { q = '', alle } = await searchParams
  const suche = q.trim()
  const zeilen = await mitMandant((tx) => listeMietverhaeltnisse(tx, heuteBerlin()))
  const laufend = zeilen.filter((z) => z.laufend).length
  const sichtbar = zeilen.filter(
    (z) => (alle || suche ? true : z.laufend) && (!suche || passt(z, suche)),
  )

  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Mieter</h1>
          <p className="leise">
            {laufend === 0
              ? 'Noch keine laufenden Mietverhältnisse.'
              : laufend +
                (laufend === 1 ? ' laufendes Mietverhältnis' : ' laufende Mietverhältnisse') +
                ' über alle Objekte.'}
          </p>
        </div>
      </div>
      <div className="zeile" style={{ marginBottom: 16 }}>
        <nav className="reiter" aria-label="Filter">
          <Link href="/mietverhaeltnisse" aria-current={alle || suche ? undefined : 'page'}>
            Laufend
          </Link>
          <Link href="/mietverhaeltnisse?alle=1" aria-current={alle && !suche ? 'page' : undefined}>
            Alle
          </Link>
        </nav>
        <form action="/mietverhaeltnisse" role="search" className="suche">
          <label>
            <span className="sr-only">Suche</span>
            <span className="suchfeld">
              <Search size={16} aria-hidden />
              <input
                name="q"
                type="search"
                defaultValue={suche}
                placeholder="Name, E-Mail, Einheit, Objekt"
              />
            </span>
          </label>
        </form>
      </div>
      {sichtbar.length === 0 ? (
        <p className="leise" data-testid="mieter-leer">
          {suche
            ? 'Kein Mietverhältnis passt zur Suche.'
            : zeilen.length === 0
              ? 'Noch keine Mietverhältnisse. Mieter legst du in der Objektakte an der jeweiligen Einheit an.'
              : 'Keine laufenden Mietverhältnisse.'}
          {zeilen.length === 0 ? (
            <>
              {' '}
              <Link href="/">Zu den Objekten</Link>
            </>
          ) : null}
        </p>
      ) : null}
      <ul className="liste" data-testid="mieterliste">
        {sichtbar.map((z) => (
          <li key={z.mietverhaeltnisId} className="karte objektkarte" data-testid="mieter-zeile">
            <div className="objektkarte-kopf">
              <span className="icon-kachel">
                <Contact size={20} strokeWidth={1.75} aria-hidden />
              </span>
              <span className="objektkarte-titel">
                <Link href={'/mietverhaeltnisse/' + z.mietverhaeltnisId}>
                  <strong>{z.mieterNamen.join(', ') || 'ohne Mieter'}</strong>
                </Link>
                <span className="meta">
                  <span>
                    <Link href={'/objekte/' + z.objektId}>{z.objekt}</Link> · {z.einheit}
                  </span>
                  <span>
                    {z.ende
                      ? datumAnzeige(z.beginn) + ' bis ' + datumAnzeige(z.ende)
                      : 'seit ' + datumAnzeige(z.beginn)}
                  </span>
                </span>
              </span>
              {z.kaltmieteCent != null ? (
                <span className="ziffern" title="Kaltmiete">
                  {euroAnzeige(z.kaltmieteCent)}
                </span>
              ) : null}
            </div>
            <p className="meta">
              {z.mieterEmails.map((e) => (
                <a key={e} href={'mailto:' + e}>
                  <Mail size={14} aria-hidden /> {e}
                </a>
              ))}
              {z.mieterTelefone.map((t) => (
                <a key={t} href={'tel:' + t.replace(/[^+\d]/g, '')}>
                  <Phone size={14} aria-hidden /> {t}
                </a>
              ))}
              {!z.laufend ? <span>beendet</span> : null}
            </p>
          </li>
        ))}
      </ul>
    </>
  )
}
