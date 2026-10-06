# ADR 0002 · Mandant = Eigentümerschaft

Status: angenommen · 06.10.2026

## Kontext

Geschwister besitzen ein Objekt gemeinsam und daneben eigene Objekte. Steuerlich wird nach Anteilen aufgeteilt. Die RLS-Grenze muss eindeutig sein.

## Entscheidung

Jede Eigentümerschaft (allein, Ehepaar, Bruchteilsgemeinschaft, GbR) ist ein eigener Mandant und entspricht einer Better-Auth-Organization. Ein Nutzer kann Mitglied mehrerer Mandanten sein und wechselt in der Oberfläche zwischen ihnen. Handwerker, Wissensbasis und Journal gehören zum Mandanten.

## Konsequenzen

Ein Handwerker, den zwei Mandanten nutzen, existiert zweimal. Das ist Absicht: keine mandantenübergreifenden Fremdschlüssel. Die Steueraufteilung nach Miteigentumsanteilen ist ein Attribut des Mandanten, kein Sonderfall einzelner Objekte.
