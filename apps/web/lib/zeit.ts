/**
 * Ortszeit Berlin ↔ ISO-Zeitpunkt. Formulare liefern `2026-10-07T10:30` ohne Zeitzone
 * (input type="datetime-local"); gemeint ist immer die Zeit in Deutschland.
 */
const ZONE = 'Europe/Berlin'

function versatzMinuten(utcMs: number): number {
  const teile = new Intl.DateTimeFormat('en-US', {
    timeZone: ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(new Date(utcMs))
  const w = (t: string) => Number(teile.find((p) => p.type === t)?.value)
  const alsUtc = Date.UTC(w('year'), w('month') - 1, w('day'), w('hour'), w('minute'))
  return Math.round((alsUtc - utcMs) / 60_000)
}

/** `2026-10-07T10:30` (Berlin) → `2026-10-07T08:30:00.000Z`. Wirft bei ungültiger Eingabe. */
export function berlinZuIso(lokal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(lokal)
  if (!m) throw new Error(`Kein gültiger Zeitpunkt: ${lokal}`)
  const [, j, mo, t, h, mi] = m.map(Number) as [number, number, number, number, number, number]
  const naiv = Date.UTC(j, mo - 1, t, h, mi)
  // Zweimal annähern: Der Versatz hängt vom Zeitpunkt selbst ab (Sommer-/Winterzeit).
  let utc = naiv - versatzMinuten(naiv) * 60_000
  utc = naiv - versatzMinuten(utc) * 60_000
  return new Date(utc).toISOString()
}

/** ISO-Zeitpunkt → `2026-10-07T10:30` in Berliner Ortszeit, für datetime-local-Felder. */
export function isoZuBerlin(iso: string): string {
  const ms = new Date(iso).getTime()
  return new Date(ms + versatzMinuten(ms) * 60_000).toISOString().slice(0, 16)
}

/** Heutiges Datum in Berlin, „2026-10-07“. */
export function heuteBerlin(): string {
  return isoZuBerlin(new Date().toISOString()).slice(0, 10)
}
