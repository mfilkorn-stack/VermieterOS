import 'server-only'
import { adresssucheAn } from './adresse'
import { firmensucheAn } from './firma'
import { kiEingerichtet } from './ki'
import { mailEingerichtet } from './mail'

/**
 * Angaben für die Datenschutzinformation (/datenschutz). Der Verantwortliche kommt aus der
 * Umgebung, nicht aus dem Repository; die Empfänger richten sich nach den eingerichteten Diensten.
 *   DATENSCHUTZ_VERANTWORTLICHER, DATENSCHUTZ_ANSCHRIFT, DATENSCHUTZ_EMAIL
 */
export type Verantwortlicher = { name: string; anschrift: string | null; email: string | null }

export function verantwortlicher(): Verantwortlicher | null {
  const name = process.env['DATENSCHUTZ_VERANTWORTLICHER']?.trim()
  if (!name) return null
  return {
    name,
    anschrift: process.env['DATENSCHUTZ_ANSCHRIFT']?.trim() || null,
    email: process.env['DATENSCHUTZ_EMAIL']?.trim() || null,
  }
}

export type Empfaenger = {
  name: string
  aufgabe: string
  daten: string
  ort: string
}

export function empfaenger(): Empfaenger[] {
  const liste: Empfaenger[] = [
    {
      name: 'Hetzner Online GmbH',
      aufgabe: 'Server, Datenbank, Dateispeicher und verschlüsselte Sicherungen',
      daten: 'alle in der Anwendung gespeicherten Daten',
      ort: 'Deutschland',
    },
  ]
  if (mailEingerichtet()) {
    const host = process.env['SMTP_HOST'] ?? ''
    liste.push({
      name: /ionos/i.test(host) ? 'IONOS SE' : 'Mailanbieter (' + host + ')',
      aufgabe: 'Versand von E-Mails (Anmeldelinks, Einladungen, Abrechnungen, Nachrichten)',
      daten: 'E-Mail-Adresse, Inhalt der jeweiligen Mail',
      ort: /ionos/i.test(host) ? 'Deutschland' : 'laut Anbieter',
    })
  }
  if (kiEingerichtet()) {
    liste.push({
      name: 'Anthropic PBC',
      aufgabe:
        'KI-Assistenz: Einordnen eingehender Mails, Antwortentwürfe, Auslesen von Verträgen und Belegen',
      daten:
        'Inhalt der jeweiligen Mail oder des Dokuments, dazu nötige Angaben zum Mietverhältnis',
      ort: 'USA; Übermittlung auf Grundlage der EU-Standardvertragsklauseln',
    })
  }
  if (adresssucheAn() || firmensucheAn()) {
    liste.push({
      name: 'komoot GmbH (Photon, OpenStreetMap)',
      aufgabe: 'Vorschläge bei der Eingabe von Anschriften und Handwerksbetrieben',
      daten: 'nur der eingegebene Suchtext, ohne Name oder Konto',
      ort: 'Deutschland',
    })
  }
  if (firmensucheAn()) {
    liste.push({
      name: 'OpenStreetMap Foundation (Nominatim)',
      aufgabe: 'Telefon, E-Mail und Webseite zu einem ausgewählten Handwerksbetrieb',
      daten: 'nur die Kennung des gewählten OpenStreetMap-Eintrags',
      ort: 'Vereinigtes Königreich (Angemessenheitsbeschluss der EU)',
    })
  }
  return liste
}
