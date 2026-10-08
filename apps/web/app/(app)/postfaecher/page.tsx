import { listePostfaecher } from '@vermieteros/db'
import { redirect } from 'next/navigation'
import { Auswahl, Feld } from '@/components/felder'
import { Formular } from '@/components/formular'
import { datumAnzeige, zeitpunktAnzeige } from '@/lib/format'
import { darf, mitMandant } from '@/lib/sitzung'
import { postfachAendern, postfachAnlegen } from './aktionen'
import { KiHinweis } from '@/components/ki-hinweis'
import { kiEingerichtet } from '@/lib/ki'

export default async function PostfaecherSeite() {
  if (!(await darf({ post: ['postfaecher'] }))) redirect('/posteingang')
  const postfaecher = await mitMandant((tx) => listePostfaecher(tx))
  const vor30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)

  return (
    <>
      <h1>Postfächer</h1>
      <p className="leise">
        Vermieter.OS liest das Postfach nur: keine Markierung als gelesen, nichts wird verschoben
        oder gelöscht. Abruf alle paar Minuten. Das Passwort wird verschlüsselt gespeichert und nie
        wieder angezeigt; am besten ein App-Passwort des Anbieters verwenden.
      </p>
      {kiEingerichtet() && process.env['KI_SORTIERUNG'] !== 'aus' ? (
        <KiHinweis was="Jede neu abgerufene Mail wird automatisch nach Thema und Dringlichkeit eingeordnet und" />
      ) : null}
      <ul className="liste" data-testid="postfachliste">
        {postfaecher.map((p) => (
          <li key={p.id} className="karte" data-testid={`postfach-${p.bezeichnung}`}>
            <div className="zeile">
              <strong>
                {p.bezeichnung}
                {p.zweck === 'belege' ? <span className="leise"> · Beleg-Adresse</span> : null}
              </strong>
              <span
                className={`ampel ampel-${!p.aktiv ? 'gelb' : p.letzterFehler ? 'rot' : 'gruen'}`}
              >
                {!p.aktiv ? 'deaktiviert' : p.letzterFehler ? 'Fehler beim Abruf' : 'aktiv'}
              </span>
            </div>
            <p className="leise">
              {p.benutzer} · {p.host}:{p.port}
              {p.tls ? '' : ' (ohne TLS)'} · Ordner {p.ordner} · ab {datumAnzeige(p.abrufAb)} ·
              letzter Abruf:{' '}
              <span data-testid="letzter-abruf">
                {p.letzterAbruf ? zeitpunktAnzeige(p.letzterAbruf) : 'noch nie'}
              </span>
            </p>
            {p.letzterFehler ? <p className="fehler">{p.letzterFehler}</p> : null}
            <details>
              <summary>Ändern</summary>
              <Formular aktion={postfachAendern} knopf="Passwort ersetzen">
                <input type="hidden" name="postfachId" value={p.id} />
                {[
                  ['bezeichnung', p.bezeichnung],
                  ['host', p.host],
                  ['port', String(p.port)],
                  ['benutzer', p.benutzer],
                  ['ordner', p.ordner],
                ].map(([n, w]) => (
                  <input key={n} type="hidden" name={n} value={w} />
                ))}
                {p.tls ? <input type="hidden" name="tls" value="on" /> : null}
                <Feld
                  label="Neues Passwort"
                  name="passwort"
                  type="password"
                  autoComplete="new-password"
                />
              </Formular>
              <Formular aktion={postfachAendern} knopf={p.aktiv ? 'Deaktivieren' : 'Aktivieren'}>
                <input type="hidden" name="postfachId" value={p.id} />
                <input
                  type="hidden"
                  name="aktion"
                  value={p.aktiv ? 'deaktivieren' : 'aktivieren'}
                />
              </Formular>
            </details>
          </li>
        ))}
      </ul>
      <div className="karte">
        <h2>Postfach hinzufügen</h2>
        <Formular
          aktion={postfachAnlegen}
          knopf="Verbindung prüfen und speichern"
          testId="postfach"
        >
          <Feld label="Bezeichnung" name="bezeichnung" defaultValue="Vermietung" required />
          <Auswahl
            label="Zweck"
            name="zweck"
            optionen={[
              ['post', 'Post von Mietern und Handwerkern (Posteingang)'],
              ['belege', 'Beleg-Adresse: Anhänge landen im Belegeingang'],
            ]}
          />
          <div className="zeile">
            <Feld
              label="IMAP-Server"
              name="host"
              required
              hinweis="z. B. imap.ionos.de, imap.gmx.net"
            />
            <Feld label="Port" name="port" defaultValue="993" inputMode="numeric" />
          </div>
          <label className="haken">
            <input type="checkbox" name="tls" defaultChecked /> Verschlüsselt (TLS), nur für lokale
            Tests abschalten
          </label>
          <div className="zeile">
            <Feld label="Benutzer" name="benutzer" required autoComplete="off" />
            <Feld
              label="Passwort"
              name="passwort"
              type="password"
              required
              autoComplete="new-password"
            />
          </div>
          <div className="zeile">
            <Feld label="Ordner" name="ordner" defaultValue="INBOX" />
            <Feld
              label="Abruf ab"
              name="abrufAb"
              type="date"
              defaultValue={vor30}
              required
              hinweis="Ältere Mails bleiben draußen."
            />
          </div>
        </Formular>
      </div>
    </>
  )
}
