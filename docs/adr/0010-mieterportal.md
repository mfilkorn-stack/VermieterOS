# ADR 0010 · Mieterportal: eigene Identität per Einmal-Link, Mailversand über SMTP

Status: angenommen · 07.10.2026 · WP 1.10

## Entscheidung

**Eigene Portal-Identität statt Better-Auth-Konten.** Mieter bekommen kein Konto in der Verwaltung, sondern einen Zugang (`portal_zugaenge`) zu genau einem Mietverhältnis und einer Mieterperson, mit E-Mail-Adresse. Angemeldet wird per Einmal-Link, ohne Passwort. Die Sitzung liegt im Cookie `vos_portal` (httpOnly, SameSite=Lax, Pfad `/portal`, 30 Tage) und ist von der Vermieter-Sitzung vollständig getrennt; eine Portal-Sitzung kann keine Seite der Verwaltung öffnen und umgekehrt.

**Nur Hashes in der Datenbank.** Links und Sitzungen sind 256-Bit-Zufallswerte; gespeichert wird nur ihr SHA-256 (`portal_tokens`, `portal_sitzungen`). Auf beide Tabellen hat die App-Rolle keinerlei Rechte. Anlegen, Einlösen, Lesen und Beenden laufen über fünf SECURITY-DEFINER-Funktionen (Migration 0024). Ein Link gilt 15 Minuten (Einladung: 7 Tage) und genau einmal; je Zugang höchstens fünf Links in 15 Minuten. Mit Mandantenkontext (Einladung) nimmt die Datenbank nur Zugänge des eigenen Mandanten an.

**Keine Auskunft über Adressen.** „Link anfordern“ antwortet immer gleich, ob die Adresse bekannt ist oder nicht.

**Einlösen per Knopf, nicht beim Öffnen.** Virenscanner in Mailprogrammen rufen Links vorab auf. Würde schon das Öffnen den Link einlösen, wäre er für den Mieter verbraucht. Die Seite `/portal/anmelden` zeigt deshalb nur einen Knopf; erst der POST löst ein.

**Sichtbarkeit wird in der App eingeschränkt, nicht in der Datenbank.** RLS trennt nach Mandant. Innerhalb des Mandanten filtert `lib/portal-daten.ts` jede Abfrage auf das Mietverhältnis der Sitzung und gibt nur freigegebene Felder heraus: Wohnung, heute geltende Miete, Notfallkarte, für Mieter sichtbare Wissensartikel, eigene Meldungen (Titel, Status, Termin; keine Notizen, kein Auftragnehmer) und gültige Dokumente der Arten Mietvertrag, Nachtrag, Übergabeprotokoll und Bescheinigung. Der Vertrag ist vollständig sichtbar.

**Schreiben nur zwei Dinge.** Mängel werden Tickets im Status „gemeldet“ am eigenen Mietverhältnis (Fotos als Dokumente der Art „Mangelfoto“ am Ticket), Nachrichten landen append-only in `portal_nachrichten` und im Verlauf. Akteur ist jeweils `portal` mit der Zugangs-ID. Der Vermieter wird per Mail benachrichtigt.

**Widerruf statt Löschen.** Ein Zugang wird einmalig gesperrt; offene Links und alle Sitzungen enden sofort. Einladen und Sperren stehen im Ledger.

**Mailversand über SMTP, anbieterneutral.** `nodemailer` mit `SMTP_HOST`, `SMTP_PORT`, `SMTP_BENUTZER`, `SMTP_PASSWORT`, `MAIL_ABSENDER`. Empfehlung für den Start: Brevo (kostenlos bis 300 Mails am Tag, Server in der EU, AVV) oder das SMTP des eigenen Mail-Hosters. Ohne SMTP wird nichts verschickt; Einladungslinks erscheinen dann in der App zum persönlichen Weitergeben.

## Begründung

Better-Auth-Konten für Mieter hätten Passwörter, 2FA-Regeln und Rollen der Verwaltung in eine Gruppe getragen, die nur gelegentlich hineinschaut und für die ein Konto eine Hürde ist. Ein Einmal-Link an die Adresse, die der Vermieter ohnehin pflegt, ist für Mieter einfacher und hat eine kleinere Angriffsfläche. Getrennte Tabellen ohne App-Rechte sorgen dafür, dass selbst ein Fehler in einer Abfrage der App keine gültigen Links oder Sitzungen preisgibt.

## Konsequenzen

Wer Zugriff auf das Postfach des Mieters hat, hat Zugriff aufs Portal; das entspricht dem Stand jeder „Passwort vergessen“-Funktion. Die Einschränkung aufs Mietverhältnis ist App-Code und braucht bei jeder neuen Portal-Abfrage dieselbe Sorgfalt; deshalb liegen alle Portal-Lesefunktionen an einem Ort. Endet ein Mietverhältnis, bleibt der Zugang bestehen, bis der Vermieter ihn sperrt.
