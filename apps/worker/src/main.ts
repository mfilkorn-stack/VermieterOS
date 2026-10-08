import {
  aktivePostfaecherAllerMandanten,
  createDb,
  mandantenMitNeuenDokumenten,
} from '@vermieteros/db'
import {
  BELEG_TAGE,
  belegeAuslesen,
  kiClientAusUmgebung,
  sortiereNeueNachrichten,
} from '@vermieteros/ki'
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
 * Mit ANTHROPIC_API_KEY sortiert er danach neue Mails (WP 1.5), höchstens KI_SORTIERUNG_LIMIT
 * pro Durchlauf (Standard 20); KI_SORTIERUNG=aus schaltet das ab. Danach liest er neue Belege
 * aus (WP 1.8), höchstens KI_BELEGE_LIMIT pro Durchlauf (Standard 10).
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
const kiClient = kiClientAusUmgebung()
// KI_SORTIERUNG=aus schaltet nur das Einordnen der Mails ab, nicht das Auslesen der Belege.
const ki = process.env['KI_SORTIERUNG'] === 'aus' ? null : kiClient
const kiLimit = Number(process.env['KI_SORTIERUNG_LIMIT'] ?? 20)
const belegLimit = Number(process.env['KI_BELEGE_LIMIT'] ?? 10)

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
  if (!kiClient) return
  const mandantIds = (await aktivePostfaecherAllerMandanten(db)).map((p) => p.mandantId)
  if (ki) {
    const s = await sortiereNeueNachrichten({ db, client: ki, mandantIds, limit: kiLimit, log })
    if (s.sortiert || s.fehler) log(`Sortierung: ${s.sortiert} sortiert, ${s.fehler} gescheitert`)
  }
  // Belege auch bei Mandanten ohne Postfach (Upload, Rechnung am Ticket, Dokument-Upload)
  const belegMandanten = [
    ...new Set([...mandantIds, ...(await mandantenMitNeuenDokumenten(db, BELEG_TAGE))]),
  ]
  const b = await belegeAuslesen({
    db,
    client: kiClient,
    quelle: speicher,
    mandantIds: belegMandanten,
    limit: belegLimit,
    log,
  })
  if (b.gelesen || b.fehler) log(`Belege: ${b.gelesen} ausgelesen, ${b.fehler} gescheitert`)
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
