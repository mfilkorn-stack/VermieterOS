/**
 * Scans haben keine Textebene, die Software kann die Fundstellen nicht prüfen. Die Werte sind
 * trotzdem vorbelegt; übernommen wird erst nach dieser ausdrücklichen Bestätigung.
 */
export function ScanBestaetigung() {
  return (
    <label className="haken" data-testid="scan-bestaetigung">
      <input type="checkbox" name="scanGeprueft" value="ja" required />
      Das Dokument ist ein Scan. Ich habe die angehakten Werte am Dokument geprüft.
    </label>
  )
}
