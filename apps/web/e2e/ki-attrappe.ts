import { createServer, type Server } from 'node:http'

/**
 * Ersatz für die Anthropic-API in E2E-Tests und der Vorschau: beantwortet Sortierung und
 * Antwortentwurf mit festen, regelkonformen Ausgaben. So läuft der echte Client-Pfad
 * (SDK, Schema, Stempel, Speicherung) ohne Netz und ohne Kosten.
 */
type Anfrage = {
  system: Array<{ text: string }>
  messages: Array<{ content: Array<{ type: string; text?: string }> }>
}

function antwort(a: Anfrage): unknown {
  const system = a.system.map((s) => s.text).join('\n')
  if (system.includes('Wohnraummietverträge')) {
    // Passt zu musterMietvertrag(); die Kaution ist absichtlich falsch und darf nicht belegt sein.
    const f = (wert: string, zitat: string) => ({ wert, seite: 2, zitat })
    return {
      mietbeginn: f('01.09.2021', 'Das Mietverhältnis beginnt am 01.09.2021.'),
      kaltmiete: f('650,00 €', 'Die Nettokaltmiete beträgt 650,00 € monatlich.'),
      vorauszahlung_betriebskosten: f('120,00 €', 'Vorauszahlung Betriebskosten: 120,00 €'),
      vorauszahlung_heizkosten: f('80,00 €', 'Vorauszahlung Heizkosten: 80,00 €'),
      kaution: f('2.000,00 €', 'Kaution von 2.000,00 €'),
      kuendigungsfrist_monate: f('drei Monate', 'Die Kündigungsfrist beträgt drei Monate.'),
      mieter: ['Erika Beispiel'],
      hinweise: [],
    }
  }
  const text = a.messages[0]!.content.find((b) => b.type === 'text')?.text ?? '{}'
  const inhalt = JSON.parse(text) as {
    mail: { betreff: string; text: string }
    erlaubte_platzhalter?: Record<string, string>
  }
  const mail = `${inhalt.mail.betreff} ${inhalt.mail.text}`.toLowerCase()
  if (system.includes('Posteingang zu sortieren')) {
    const heizung = mail.includes('heizung')
    return {
      kategorie: heizung ? 'heizung_wasser' : 'nachbarn_hausordnung',
      dringlichkeit: heizung ? 'notfall' : 'normal',
      frist: null,
      zusammenfassung: heizung ? 'Die Heizung ist ausgefallen.' : 'Hinweis zum Grundstück.',
      begruendung: heizung ? 'Heizungsausfall' : 'Kein dringender Handlungsbedarf',
    }
  }
  const anrede = inhalt.erlaubte_platzhalter?.['mieter.name']
    ? '{{mieter.name}}'
    : '{{absender.name}}'
  return {
    entwurf: [
      `Guten Tag ${anrede},`,
      '',
      'vielen Dank für Ihre Nachricht. Wir kümmern uns darum und melden uns kurzfristig bei Ihnen.',
      '',
      'Viele Grüße',
      '{{vermieter.name}}',
    ].join('\n'),
    zusagen: [],
    offene_punkte: ['Termin mit dem Handwerker abstimmen'],
  }
}

export function starteKiAttrappe(port: number): Promise<Server> {
  const server = createServer((req, res) => {
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      const text = JSON.stringify(antwort(JSON.parse(body) as Anfrage))
      res.writeHead(200, { 'content-type': 'application/json', 'request-id': 'req_attrappe' })
      res.end(
        JSON.stringify({
          id: 'msg_attrappe',
          type: 'message',
          role: 'assistant',
          model: 'attrappe',
          content: [{ type: 'text', text }],
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 1, output_tokens: 1 },
        }),
      )
    })
  })
  return new Promise((r) => server.listen(port, '127.0.0.1', () => r(server)))
}
