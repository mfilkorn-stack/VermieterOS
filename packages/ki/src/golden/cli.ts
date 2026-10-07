import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { AUFGABEN } from '../aufgaben/index'
import { kiClientAusUmgebung, kiModell } from '../client'
import { seitenTexte } from '../pdf'
import { GoldenFall, laufeGoldenSet } from './lauf'

/**
 * Golden-Set gegen das echte Modell: `pnpm --filter @vermieteros/ki golden [aufgabe]`.
 * Läuft vor jedem Prompt- oder Modellwechsel und wöchentlich in CI (PLAN 4.5).
 * Ohne ANTHROPIC_API_KEY wird übersprungen, nicht gescheitert.
 */
const ORDNER = resolve(import.meta.dirname, '../../golden')

async function main(): Promise<number> {
  const client = kiClientAusUmgebung()
  if (!client) {
    console.log('Golden-Set übersprungen: ANTHROPIC_API_KEY ist nicht gesetzt.')
    return 0
  }
  const modell = kiModell()
  const nur = process.argv[2]
  const aufgaben = AUFGABEN.filter((a) => !nur || a.name === nur)
  let ok = true
  let gelaufen = 0
  for (const aufgabe of aufgaben) {
    const dir = join(ORDNER, aufgabe.name)
    if (!existsSync(dir)) {
      console.log(`${aufgabe.name}: kein Ordner golden/${aufgabe.name}, übersprungen`)
      continue
    }
    const faelle = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .sort()
      .map((f) => ({
        name: f,
        fall: GoldenFall.parse(JSON.parse(readFileSync(join(dir, f), 'utf8'))),
      }))
    const r = await laufeGoldenSet(aufgabe, faelle, client, modell)
    gelaufen++
    ok &&= r.ok
    console.log(
      `${r.ok ? '✓' : '✗'} ${r.aufgabe} mit ${modell}: ${r.bestanden}/${r.gesamt} (${Math.round(r.quote * 100)} %, Schwelle ${Math.round(r.schwelle * 100)} %)`,
    )
    for (const f of r.faelle.filter((x) => !x.bestanden)) {
      console.log(`  ✗ ${f.name}`)
      for (const b of f.befunde) console.log(`    - ${b}`)
    }
  }
  if (gelaufen === 0) console.log('Keine Aufgabe mit Golden-Set-Fällen registriert.')
  return ok ? 0 : 1
}

process.exit(await main())
