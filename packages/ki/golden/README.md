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
