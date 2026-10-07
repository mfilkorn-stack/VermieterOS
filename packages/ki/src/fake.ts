import type { KiAnfrage, KiAntwort, KiClient } from './client'

/**
 * Client für Tests: liefert vorgegebene Ausgaben der Reihe nach und merkt sich die Anfragen.
 * Eine Funktion als Antwort sieht die Anfrage, etwa um auf den Kontext zu reagieren.
 */
export class FakeKiClient implements KiClient {
  readonly anfragen: Array<KiAnfrage<unknown>> = []
  private readonly antworten: Array<unknown | ((a: KiAnfrage<unknown>) => unknown)>

  constructor(...antworten: Array<unknown | ((a: KiAnfrage<unknown>) => unknown)>) {
    this.antworten = antworten
  }

  async erzeuge<T>(a: KiAnfrage<T>): Promise<KiAntwort<T>> {
    this.anfragen.push(a as KiAnfrage<unknown>)
    const naechste = this.antworten.shift()
    if (naechste === undefined) throw new Error('FakeKiClient: keine Antwort mehr vorgesehen')
    const roh = typeof naechste === 'function' ? naechste(a as KiAnfrage<unknown>) : naechste
    if (roh instanceof Error) throw roh
    return {
      ausgabe: roh as T,
      modell: a.modell,
      anfrageId: `fake-${this.anfragen.length}`,
      nutzung: { eingabe: 0, ausgabe: 0, cacheGelesen: 0, cacheGeschrieben: 0 },
    }
  }
}
