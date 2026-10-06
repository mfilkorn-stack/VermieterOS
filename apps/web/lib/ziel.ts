/**
 * Nur relative Pfade innerhalb der App als Weiterleitungsziel (Schutz gegen Open Redirect
 * über `?weiter=`). Protokoll-relative URLs und Backslash-Tricks werden verworfen.
 */
export function sicheresZiel(weiter: unknown, standard = '/'): string {
  if (typeof weiter !== 'string' || weiter.length > 500) return standard
  if (!weiter.startsWith('/')) return standard
  if (weiter.startsWith('//') || weiter.startsWith('/\\')) return standard
  if (/[\u0000-\u001f\\]/.test(weiter)) return standard
  return weiter
}
