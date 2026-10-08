# Golden-Set

Echte, geschwärzte Beispiele mit erwarteten Ergebnissen (PLAN 4.5). Ein Ordner pro Aufgabe aus dem Prompt-Register (`src/aufgaben/index.ts`), eine JSON-Datei pro Fall:

```json
{
  "beschreibung": "Heizung fällt im Winter aus, Mieterin bittet um Termin",
  "synthetisch": false,
  "daten": {
    "betreff": "…",
    "text": "…",
    "absender": "…",
    "eingegangen": "…",
    "anhaenge": [],
    "zuordnung": null
  },
  "platzhalter": { "mieter.name": "Name der Mieterin" },
  "erwartet": { "kategorie": "heizung", "dringlichkeit": "hoch" }
}
```

`daten` hat die Form, die der Kontext-Builder der Aufgabe liefert. `erwartet` nennt nur die Felder, die genau stimmen müssen. Freie Texte werden nicht verglichen, sondern geprüft: keine Zahl im Entwurf, nur Platzhalter aus `platzhalter`.

**Schwärzen:** Namen, Adressen, Telefonnummern, IBAN, Vertragsnummern ersetzen, bevor ein Fall ins Repository kommt. Das Repository ist kein Ort für personenbezogene Daten.

**Ausführen:** `ANTHROPIC_API_KEY=… pnpm --filter @vermieteros/ki golden [aufgabe]`. Läuft vor jedem Prompt- oder Modellwechsel und wöchentlich in CI (`.github/workflows/ki-golden.yml`). Ein günstigeres Modell (`KI_MODELL=…`) wird nur eingesetzt, wenn es das Set gleich gut besteht.

**Dateien:** Für Aufgaben, die eine Datei lesen (`mietvertrag_extraktion`), nennt `datei` eine Datei neben dem Fall, z. B. `"datei": "01-vertrag.pdf"`. Der Runner lädt sie als `daten.datei` und liest bei PDFs den Text je Seite. Erwartet werden dann Felder wie `{"kaltmiete": {"wert": "650,00 €", "seite": 2}}`. Für Mietverträge gibt es einen synthetischen Fall nach einem leeren Formular (alle Werte müssen null bleiben: leere Felder, Inklusivmiete, Vorauszahlungen je Kostenart, Sonderkündigungsfrist); dazu zwei ausgefüllte synthetische Verträge: Kaltmiete, Stellplatz und Gesamtmiete getrennt; Formular mit Vorauszahlungen je Kostenart und Summe, Heizkosten „siehe Anlage“, aufgedruckten Seitenzahlen ungleich PDF-Seiten. Bei Beträgen in unterschiedlicher Schreibweise („EUR 510,-“) prüft der Fall nur die Seite; den Betrag prüft die Fundstellenprüfung. Ein echter, geschwärzter Vertrag fehlt noch (PLAN Kapitel 8). `kaufvertrag_extraktion` hat einen synthetischen Fall (ETW mit Stellplatz, `musterKaufvertrag()`). `beleg_extraktion` hat vier synthetische Fälle mit erzeugten Muster-PDFs (Wasser, Handwerker, Steuerberatung, Versicherung); erwartet werden vor allem Einordnung und Betrag. Echte, geschwärzte Belege ersetzen sie, Ziel sind 30 Fälle (Phasen-DoD).
