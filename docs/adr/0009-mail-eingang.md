# ADR 0009 · Mail-Eingang: Worker ohne Queue, Postfach nur lesen, lieber offen als falsch

Status: angenommen · 07.10.2026 · ergänzt PLAN.md 2.1 (BullMQ/Redis vorerst nicht)

## Entscheidung

**Worker ohne Queue.** `apps/worker` ist eine Schleife: alle aktiven Postfächer nacheinander abrufen, dann Pause (`ABRUF_INTERVALL_SEKUNDEN`, Standard 300). Den Abrufstand hält Postgres am Postfach. Er besteht aus UIDVALIDITY, letzter UID, letztem Abruf und letztem Fehler. BullMQ und Redis kommen erst, wenn Aufträge aus der Web-App asynchron laufen müssen, etwa KI-Aufrufe in WP 1.4.

**Eigene Datenbankrolle `vermieteros_worker`.** Sie hat keine Sonderrechte an RLS vorbei. Eine zusätzliche Policy erlaubt ihr nur, die Postfächer aller Mandanten zu sehen. Alles andere schreibt sie wie die App im Mandantenkontext. Ihre Rechte sind auf Postfach-Stand, Nachrichten, Anhänge, Zuordnungen und Ledger beschränkt. Stammdaten kann sie nur lesen.

**Postfach nur lesen.** Der Ordner wird mit EXAMINE geöffnet. Es gibt keine Gelesen-Markierung, nichts wird verschoben oder gelöscht. Der Mailclient des Vermieters bleibt die Wahrheit für den Lesestatus. Beim ersten Abruf zählt `abruf_ab`, damit kein Altbestand einläuft.

**Ablage.** Die vollständige Mail (.eml) und jeder Anhang liegen inhaltsadressiert im Object Storage, Schlüssel und SHA-256 stehen an der Nachricht. In der Datenbank stehen Kopfdaten und der Textteil. Ein erneuter Abruf derselben Mail wird über die Prüfsumme erkannt. Das Ledger erhält nur Metadaten und Prüfsummen, keinen Inhalt.

**Zuordnung.** Die erste eindeutige Regel gewinnt:

1. Antwort auf eine bereits zugeordnete Nachricht (In-Reply-To und References)
2. Die Absenderadresse gehört zu Mietern genau eines zeitlich passenden Mietverhältnisses
3. Mehrere Mietverhältnisse passen, aber der Betreff nennt genau eine Einheit oder Anschrift

Sonst bleibt die Nachricht offen. Jede Zuordnung ist ein eigener append-only Eintrag mit Art und Akteur, auch die manuelle und das Aufheben. Automatisch darf nur „verlauf“, „absender“ oder „absender_betreff“ eintragen. „manuell“ und „aufgehoben“ verlangen einen Nutzer.

**Passwörter.** Postfach-Passwörter sind mit AES-256-GCM verschlüsselt. Der Schlüssel `POSTFACH_SCHLUESSEL` liegt nur in der Umgebung von Web und Worker. Die App-Rolle hat kein Leserecht auf die Spalte mit der Chiffre. Die Web-App verschlüsselt also nur und liest nie zurück.

## Begründung

Eine Queue löst ein Problem, das ein Prozess mit einem Postfach pro Mandant nicht hat. Sie bringt aber einen weiteren Dienst, der betrieben und gesichert werden muss.

Eine falsche automatische Zuordnung landet unbemerkt in der falschen Mieterakte, und das ist schlimmer als eine offene Nachricht. Deshalb gilt: lieber offen als falsch.

Das Postfach nur zu lesen schützt vor dem häufigsten Ärgernis solcher Systeme: Mails sind plötzlich gelesen oder verschwunden.

## Konsequenzen

Mehrere Worker-Instanzen würden dasselbe Postfach parallel abrufen. Die Prüfsumme verhindert Doppel, aber nicht die doppelte Arbeit. Es läuft deshalb genau ein Worker. Geht `POSTFACH_SCHLUESSEL` verloren, müssen alle Postfach-Passwörter neu eingegeben werden. Die Mails im Object Storage sind Teil des nächtlichen Backups. Sie werden kopiert, nie gelöscht, und eine nachträgliche Änderung bricht das Backup ab.
