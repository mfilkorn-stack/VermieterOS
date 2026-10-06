import { RECHENKERN_VERSION } from '@vermieteros/rechenkern'

export default function Startseite() {
  return (
    <main>
      <h1>Vermieter.OS</h1>
      <p>
        Phase 0 · Fundament. Ledger, Versionierung und Mandantentrennung stehen; Oberfläche folgt.
      </p>
      <p style={{ color: '#666', fontSize: '0.9rem' }}>Rechenkern {RECHENKERN_VERSION}</p>
    </main>
  )
}
