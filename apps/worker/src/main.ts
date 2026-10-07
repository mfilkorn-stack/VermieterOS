import { createDb } from '@vermieteros/db'
import {
  rufeAlleAb,
  s3Speicher,
  schluesselAusUmgebung,
  speicherKonfigAusUmgebung,
} from '@vermieteros/post'

/**
 * Worker (PLAN.md 2.1): ruft alle aktiven Postfächer ab, dann Pause, dann wieder.
 *   node worker.mjs           Dauerbetrieb, Intervall ABRUF_INTERVALL_SEKUNDEN (Standard 300)
 *   node worker.mjs --einmal  ein Durchlauf, Exit-Code 1 bei Absturz (Tests, Fehlersuche)
 * Fehler einzelner Postfächer (falsches Passwort, Server weg) stehen am Postfach und in der App;
 * der Totmannschalter HEALTHCHECK_ABRUF meldet nur, ob der Worker selbst läuft.
 */
function log(text: string) {
  console.log(`${new Date().toISOString()} ${text}`)
}

async function melde(url: string | undefined, fehler?: string) {
  if (!url) return
  await fetch(fehler ? `${url}/fail` : url, { method: 'POST', body: fehler ?? '' }).catch(() =>
    log(`Monitor nicht erreichbar: ${url}`),
  )
}

const url = process.env['DATABASE_URL']
if (!url) throw new Error('DATABASE_URL fehlt (Rolle vermieteros_worker)')
const einmal = process.argv.includes('--einmal')
const intervall = Number(process.env['ABRUF_INTERVALL_SEKUNDEN'] ?? 300) * 1000
const monitor = process.env['HEALTHCHECK_ABRUF']

const { db, close } = createDb(url, { max: 3 })
const speicher = s3Speicher(speicherKonfigAusUmgebung())
const ctx = { db, speicher, schluessel: schluesselAusUmgebung(), log }

let laeuft = true
let wecken: (() => void) | null = null
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    log(`${signal}: beende nach dem laufenden Durchlauf`)
    laeuft = false
    wecken?.()
  })
}

async function durchlauf(): Promise<void> {
  const ergebnisse = await rufeAlleAb(ctx)
  const neu = ergebnisse.reduce((s, e) => s + e.neu, 0)
  const fehler = ergebnisse.filter((e) => e.fehler).length
  log(`Durchlauf: ${ergebnisse.length} Postfächer, ${neu} neue Nachrichten, ${fehler} mit Fehler`)
}

try {
  await speicher.bucketSicherstellen()
  do {
    try {
      await durchlauf()
      await melde(monitor)
    } catch (e) {
      const text = e instanceof Error ? e.message : String(e)
      log(`Durchlauf abgebrochen: ${text}`)
      await melde(monitor, text)
      if (einmal) process.exitCode = 1
    }
    if (einmal || !laeuft) break
    await new Promise<void>((r) => {
      wecken = r
      setTimeout(r, intervall)
    })
  } while (laeuft)
} finally {
  await close()
}
