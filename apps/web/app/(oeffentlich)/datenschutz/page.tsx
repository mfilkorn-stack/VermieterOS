import Link from 'next/link'
import { empfaenger, verantwortlicher } from '@/lib/datenschutz'
import { kiEingerichtet } from '@/lib/ki'

export const metadata = { title: 'Datenschutz · Vermieter.OS' }
export const dynamic = 'force-dynamic'

/**
 * Datenschutzinformation nach Art. 13 und 14 DSGVO für alle, deren Daten die Anwendung
 * verarbeitet: Vermieter und Mitglieder, Mieter (auch ohne Portal), Handwerker, Eigentümer.
 * Empfänger und KI-Abschnitt richten sich nach den eingerichteten Diensten.
 */
export default function DatenschutzSeite() {
  const v = verantwortlicher()
  const liste = empfaenger()
  const ki = kiEingerichtet()
  return (
    <article className="karte datenschutz" data-testid="datenschutz">
      <h1>Datenschutzinformation</h1>
      <p className="leise">
        Für Mieterinnen und Mieter, Eigentümer, Handwerker und alle, die diese Anwendung zur
        Verwaltung von Mietwohnungen nutzen.
      </p>

      <h2>Verantwortlich</h2>
      {v ? (
        <p data-testid="verantwortlicher">
          {v.name}
          {v.anschrift ? (
            <>
              <br />
              {v.anschrift}
            </>
          ) : null}
          {v.email ? (
            <>
              <br />
              <a href={'mailto:' + v.email}>{v.email}</a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="fehler" data-testid="verantwortlicher-fehlt">
          Die Angaben zum Verantwortlichen sind noch nicht hinterlegt
          (DATENSCHUTZ_VERANTWORTLICHER). Bitte wenden Sie sich an Ihre Vermieterin oder Ihren
          Vermieter.
        </p>
      )}

      <h2>Welche Daten und wozu</h2>
      <ul>
        <li>
          <strong>Mietverhältnis:</strong> Namen, Kontaktdaten, Mietbeginn, Miete, Vorauszahlungen,
          Kaution, Verträge und Schreiben. Zur Durchführung des Mietvertrags (Art. 6 Abs. 1 lit. b
          DSGVO).
        </li>
        <li>
          <strong>Abrechnungen, Steuer und Buchhaltung:</strong> Zahlungen, Belege,
          Betriebskostenabrechnungen. Zur Erfüllung gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c
          DSGVO, z. B. § 556 BGB, § 147 AO).
        </li>
        <li>
          <strong>Korrespondenz:</strong> E-Mails, Telefonnotizen, Nachrichten und Mängelmeldungen
          mit Fotos aus dem Mieterportal. Zur Durchführung des Mietvertrags und zur Bearbeitung
          Ihrer Anliegen (Art. 6 Abs. 1 lit. b und f DSGVO).
        </li>
        <li>
          <strong>Handwerker und Dienstleister:</strong> Name, Kontaktdaten, Aufträge. Zur
          Beauftragung (Art. 6 Abs. 1 lit. b und f DSGVO).
        </li>
        <li>
          <strong>Konten der Anwendung:</strong> Name, E-Mail-Adresse, Anmeldedaten mit
          Zwei-Faktor-Schutz. Zum sicheren Betrieb (Art. 6 Abs. 1 lit. b und f DSGVO).
        </li>
      </ul>
      <p>
        Die Daten stammen aus dem Mietvertrag, aus Ihrer Korrespondenz mit der Vermieterseite und
        von Dritten, soweit diese an der Verwaltung beteiligt sind (z. B. Messdienst, Hausverwaltung
        der Eigentümergemeinschaft).
      </p>

      {ki ? (
        <>
          <h2>KI-Assistenz</h2>
          <p data-testid="datenschutz-ki">
            Die Anwendung nutzt ein KI-Modell von Anthropic als Assistenz: Eingehende E-Mails werden
            nach Thema und Dringlichkeit eingeordnet, auf Wunsch entsteht ein Antwortentwurf, und
            Verträge oder Belege werden auf Knopfdruck ausgelesen. Dafür gehen der Inhalt der
            jeweiligen Mail oder des Dokuments und die dazu nötigen Angaben an Anthropic. Anthropic
            verarbeitet diese Daten als Auftragsverarbeiter und nutzt sie nicht zum Training.
            Ergebnisse sind Vorschläge: Entscheidungen trifft immer ein Mensch, es gibt keine
            automatisierte Entscheidung im Sinne von Art. 22 DSGVO. Rechtsgrundlage ist das
            berechtigte Interesse an einer zügigen und sorgfältigen Verwaltung (Art. 6 Abs. 1 lit. f
            DSGVO); Sie können dem widersprechen.
          </p>
        </>
      ) : null}

      <h2>Empfänger</h2>
      <p>
        Ihre Daten sehen nur die Personen, die das jeweilige Objekt verwalten, und, soweit nötig,
        Miteigentümer, Steuerberater und beauftragte Handwerker. Technische Dienstleister:
      </p>
      <table className="vergleich" data-testid="empfaenger">
        <thead>
          <tr>
            <th>Dienstleister</th>
            <th>Aufgabe</th>
            <th>Daten</th>
            <th>Ort</th>
          </tr>
        </thead>
        <tbody>
          {liste.map((e) => (
            <tr key={e.name}>
              <td>{e.name}</td>
              <td>{e.aufgabe}</td>
              <td>{e.daten}</td>
              <td>{e.ort}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="leise">
        Mit allen, die Daten in unserem Auftrag verarbeiten, bestehen Verträge zur
        Auftragsverarbeitung (Art. 28 DSGVO).
      </p>

      <h2>Speicherdauer</h2>
      <p>
        Daten zum Mietverhältnis speichern wir für dessen Dauer und danach, solange Ansprüche
        verjähren können (in der Regel drei Jahre). Buchungen, Belege und Abrechnungen bewahren wir
        nach den gesetzlichen Fristen auf, in der Regel zehn Jahre (§ 147 AO). Änderungen werden
        nachvollziehbar gespeichert; frühere Stände bleiben deshalb erhalten, solange die Fristen
        laufen. Danach werden die Daten gelöscht.
      </p>

      <h2>Sicherheit</h2>
      <p>
        Verschlüsselte Verbindungen, Anmeldung nur mit zweitem Faktor, Server und Datensicherungen
        in Deutschland, Sicherungen verschlüsselt, strikte Trennung der Daten verschiedener
        Vermieter. Cookies setzt die Anwendung nur, soweit sie für die Anmeldung technisch nötig
        sind; es gibt kein Tracking und keine Werbung.
      </p>

      <h2>Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung und
        Datenübertragbarkeit (Art. 15 bis 20 DSGVO). Einer Verarbeitung auf Grundlage berechtigter
        Interessen, auch der KI-Assistenz, können Sie widersprechen (Art. 21 DSGVO). Wenden Sie sich
        dazu an den oben genannten Verantwortlichen. Sie können sich außerdem bei einer
        Datenschutz-Aufsichtsbehörde beschweren, etwa in dem Bundesland, in dem Sie wohnen.
      </p>

      <p className="leise">
        <Link href="/login">Zur Anmeldung</Link> · <Link href="/portal">Zum Mieterportal</Link>
      </p>
    </article>
  )
}
