import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Status } from '@/components/status'
import { abschlussLink, ladeAbschluss, STAND_TEXT, STAND_TON } from '@/lib/jahresabschluss'
import { darf, mitMandant } from '@/lib/sitzung'
import { heuteBerlin } from '@/lib/zeit'

/** Jahresabschluss je Objekt (WP 2.7): Vorjahr als Checkliste, laufendes Jahr als Wächter. */
export default async function Jahresabschluss({
  searchParams,
}: {
  searchParams: Promise<{ jahr?: string }>
}) {
  if (!(await darf({ stammdaten: ['lesen'] }))) redirect('/')
  const laufend = Number(heuteBerlin().slice(0, 4))
  const sp = await searchParams
  const schreiben = await darf({ stammdaten: ['schreiben'] })
  const jahr = sp.jahr === String(laufend) ? laufend : laufend - 1
  const objekte = await mitMandant((tx) => ladeAbschluss(tx, jahr))
  return (
    <>
      <div className="seitenkopf">
        <div>
          <h1>Jahresabschluss {jahr}</h1>
          <p className="leise">
            {jahr === laufend
              ? 'Vollständigkeits-Wächter für das laufende Jahr: Was jetzt schon fehlt, ist offen; was erst nach Jahresende kommt, steht auf später.'
              : 'Was für Steuerberater und Mieter beisammen sein muss, je Objekt. Erledigt ist ein Jahr mit festgeschriebenem Steuerpaket.'}
          </p>
        </div>
      </div>
      <nav className="reiter" aria-label="Jahr" style={{ width: 'fit-content' }}>
        <Link href="/jahresabschluss" aria-current={jahr !== laufend ? 'page' : undefined}>
          Abschluss {laufend - 1}
        </Link>
        <Link
          href={'/jahresabschluss?jahr=' + laufend}
          aria-current={jahr === laufend ? 'page' : undefined}
        >
          Laufendes Jahr {laufend}
        </Link>
      </nav>
      {objekte.length === 0 ? <p className="karte leise">Noch keine Objekte.</p> : null}
      {objekte.map(({ roh, abschluss }) => {
        const relevant = abschluss.punkte.filter((p) => p.stand !== 'entfaellt').length
        return (
          <div key={roh.objektId} className="karte" data-testid="abschluss-objekt">
            <div className="zeile">
              <h2>{roh.objekt}</h2>
              <span className="leise" data-testid="abschluss-stand">
                {abschluss.erledigt} von {relevant} erledigt
              </span>
            </div>
            <ul className="liste-schlicht">
              {abschluss.punkte.map((p) => (
                <li
                  key={p.code}
                  data-testid="abschluss-punkt"
                  data-code={p.code}
                  data-stand={p.stand}
                >
                  <Status ton={STAND_TON[p.stand]}>{STAND_TEXT[p.stand]}</Status>{' '}
                  <strong>{p.titel}</strong> <span className="leise">{p.text}</span>
                  {p.stand === 'offen' &&
                  (schreiben ||
                    !abschlussLink(p, roh.objektId, jahr).startsWith('/dokumente/neu')) ? (
                    <>
                      {' '}
                      <Link href={abschlussLink(p, roh.objektId, jahr)}>erledigen</Link>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </>
  )
}
