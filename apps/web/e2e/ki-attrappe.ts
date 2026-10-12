import { createServer, type Server } from 'node:http'

/**
 * Ersatz für die Anthropic-API in E2E-Tests und der Vorschau: beantwortet Sortierung,
 * Antwortentwurf, Mietvertrag und Belege mit festen, regelkonformen Ausgaben. So läuft der echte Client-Pfad
 * (SDK, Schema, Stempel, Speicherung) ohne Netz und ohne Kosten.
 */
type Anfrage = {
  system: Array<{ text: string }>
  messages: Array<{
    content: Array<{ type: string; text?: string; source?: { data?: string } }>
  }>
}

/** Belege: Muster-Rechnung (Wasser) oder Muster-Steuerberatung, erkannt am PDF-Text. */
function beleg(a: Anfrage): unknown {
  const inhalt = a.messages[0]!.content
  const pdf = Buffer.from(
    inhalt.find((b) => b.type === 'document')?.source?.data ?? '',
    'base64',
  ).toString('latin1')
  const kontext = JSON.parse(inhalt.find((b) => b.type === 'text')?.text ?? '{}') as {
    objekte: Array<{ id: string; bezeichnung: string }>
  }
  const f = (wert: string, zitat: string) => ({ wert, seite: 1, zitat })
  if (pdf.includes('Steuerkanzlei')) {
    return {
      lieferant: f('Steuerkanzlei Muster', 'Steuerkanzlei Muster'),
      rechnungsnummer: f('SB-26-031', 'Rechnung Nr. SB-26-031'),
      rechnungsdatum: f('20.03.2026', 'vom 20.03.2026'),
      betrag_brutto: f('714,00 €', 'Rechnungsbetrag: 714,00 €'),
      umsatzsteuer: f('114,00 €', 'Umsatzsteuer 19 %: 114,00 €'),
      leistung_von: null,
      leistung_bis: null,
      zahlungsdatum: null,
      einordnung: {
        // „alle Objekte“ laut Rechnung: alle IDs aus der Liste
        objekt_ids: kontext.objekte.map((o) => o.id),
        steuerkategorie: 'verwaltungskosten',
        kostenart: null,
        umlagefaehig: false,
        begruendung: 'Steuerberatung für alle Objekte',
      },
      hinweise: [],
    }
  }
  const objekt = kontext.objekte.find((o) => o.bezeichnung.includes('Musterweg'))
  return {
    lieferant: f('Stadtwerke Musterstadt GmbH', 'Stadtwerke Musterstadt GmbH'),
    // absichtlich falsch: darf nicht als belegt gelten
    rechnungsnummer: f('W-2026-0816', 'Nr. W-2026-0816'),
    rechnungsdatum: f('05.01.2026', 'Rechnungsdatum: 05.01.2026'),
    betrag_brutto: f('481,50 €', 'Rechnungsbetrag: 481,50 €'),
    umsatzsteuer: f('31,50 €', 'Umsatzsteuer 7 %: 31,50 €'),
    leistung_von: f('01.01.2025', 'Abrechnungszeitraum: 01.01.2025'),
    leistung_bis: f('31.12.2025', 'bis 31.12.2025'),
    zahlungsdatum: f('15.01.2026', 'am 15.01.2026 von Ihrem Konto abgebucht'),
    einordnung: {
      objekt_ids: objekt ? [objekt.id] : [],
      steuerkategorie: 'betriebskosten',
      kostenart: 'wasserversorgung',
      umlagefaehig: true,
      begruendung: 'Trinkwasser, umlegbar nach § 2 Nr. 2 BetrKV',
    },
    hinweise: [],
  }
}

function antwort(a: Anfrage): unknown {
  const system = a.system.map((s) => s.text).join('\n')
  if (system.includes('Rechnungen und Bescheide')) return beleg(a)
  if (system.includes('Mängelmeldungen')) {
    // Passt zum Muster-PDF in den E2E-Tests (Heizung im Bad)
    return {
      titel: 'Heizung im Bad bleibt kalt',
      beschreibung:
        'Seit Montagabend bleibt der Heizkörper im Bad kalt, die übrigen werden warm. Thermostat auf 5, Entlüften ohne Erfolg. Terminwunsch vormittags.',
      prioritaet: 'hoch',
      kategorie: 'heizung_wasser',
      hinweise: [],
    }
  }
  if (system.includes('Immobilienkaufverträge')) {
    // Passt zu musterKaufvertrag(); die Fläche des Stellplatzes ist absichtlich falsch,
    // das zweite Grundbuchblatt darf deshalb nicht übernehmbar sein.
    const f = (wert: string, seite: number, zitat: string) => ({ wert, seite, zitat })
    return {
      kaufvertrag_datum: f('30.04.2021', 1, 'Verhandelt zu Musterstadt am 30.04.2021'),
      uebergang_nutzen_lasten: null,
      kaufpreis: f('187.000,00 €', 3, 'Der Kaufpreis beträgt 187.000,00 €.'),
      anteil_grund_boden: f('37.400,00 €', 3, 'auf den Grund und Boden 37.400,00 €'),
      grundbuch: [
        {
          art: 'wohnungsgrundbuch',
          amtsgericht: f('Musterstadt', 2, 'Wohnungsgrundbuch des Amtsgerichts Musterstadt'),
          blatt: f('W-1', 2, 'von Musterdorf Blatt W-1'),
          miteigentumsanteil: f('88,89/1.000', 2, '88,89/1.000 Miteigentumsanteil'),
          flurstuecke: [
            {
              nummer: f('Flurstück A', 2, 'an Flurstück A mit 464 m²'),
              flaeche: f('464 m²', 2, 'Flurstück A mit 464 m²'),
            },
            {
              nummer: f('Flurstück B', 2, 'Flurstück B mit 331 m²'),
              flaeche: f('331 m²', 2, 'Flurstück B mit 331 m²'),
            },
          ],
        },
        {
          art: 'teileigentumsgrundbuch',
          amtsgericht: f('Musterstadt', 2, 'Teileigentumsgrundbuch des Amtsgerichts Musterstadt'),
          blatt: f('G-2', 2, 'Blatt G-2'),
          miteigentumsanteil: null,
          flurstuecke: [
            {
              nummer: f('Flurstück C', 2, 'Stellplatz auf Flurstück C'),
              flaeche: f('41 m²', 2, 'Flurstück C mit 41 m²'),
            },
          ],
        },
      ],
      hinweise: [
        'Nutzen und Lasten gehen mit vollständiger Zahlung des Kaufpreises über.',
        'Mitverkaufte Einbauküche, bewertet mit 3.000,00 €.',
      ],
    }
  }
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
