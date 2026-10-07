import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

export type Bild = { bereich: string; titel: string; text: string; datei: string; mobil: boolean }
export type Stand = { commit: string; ref: string; erstellt: string; repo: string }

function h(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Statische Galerie für GitHub Pages: eine Seite, keine Skripte, Bilder in ./bilder. */
export function schreibeGalerie(ausgabe: string, bilder: Bild[], stand: Stand): void {
  const bereiche = [...new Set(bilder.map((b) => b.bereich))]
  const kurz = stand.commit.slice(0, 7)
  const repoUrl = `https://github.com/${stand.repo}`
  const abschnitte = bereiche
    .map((bereich, i) => {
      const karten = bilder
        .filter((b) => b.bereich === bereich)
        .map(
          (b) => `
        <figure class="${b.mobil ? 'mobil' : ''}">
          <a href="bilder/${h(b.datei)}" target="_blank" rel="noopener">
            <img src="bilder/${h(b.datei)}" alt="${h(b.titel)}" loading="lazy">
          </a>
          <figcaption><strong>${h(b.titel)}</strong><span>${h(b.text)}</span></figcaption>
        </figure>`,
        )
        .join('')
      return `
    <section id="b${i + 1}">
      <h2>${h(bereich)}</h2>
      <div class="raster">${karten}
      </div>
    </section>`
    })
    .join('')

  const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Vermieter.OS Vorschau</title>
<meta name="description" content="Bildschirmfotos aus einem automatischen Rundgang durch Vermieter.OS mit Musterdaten.">
<style>
  :root {
    --grund: #f6f5f2; --flaeche: #ffffff; --text: #1d1d1b; --leise: #5f5e5a;
    --linie: #dedcd6; --akzent: #2f5d50; --schatten: 0 1px 2px rgb(0 0 0 / 6%), 0 4px 16px rgb(0 0 0 / 6%);
    color-scheme: light dark;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --grund: #161615; --flaeche: #21211f; --text: #ecebe7; --leise: #a8a69f;
      --linie: #34332f; --akzent: #8cc2b0; --schatten: 0 1px 2px rgb(0 0 0 / 40%);
    }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--grund); color: var(--text);
    font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; }
  header, main, footer { max-width: 1180px; margin: 0 auto; padding: 0 16px; }
  header { padding-top: 40px; padding-bottom: 8px; }
  h1 { font-size: clamp(1.6rem, 4vw, 2.2rem); margin: 0 0 6px; letter-spacing: -0.01em; }
  .unter { color: var(--leise); margin: 0 0 16px; max-width: 70ch; }
  .stand { font-size: 0.9rem; color: var(--leise); }
  .stand code { background: var(--flaeche); border: 1px solid var(--linie); border-radius: 4px; padding: 1px 5px; }
  nav { display: flex; flex-wrap: wrap; gap: 8px; margin: 20px 0 8px; }
  nav a { color: var(--akzent); text-decoration: none; border: 1px solid var(--linie); background: var(--flaeche);
    border-radius: 999px; padding: 4px 12px; font-size: 0.92rem; }
  nav a:hover { border-color: var(--akzent); }
  section { padding-top: 28px; }
  h2 { font-size: 1.25rem; margin: 0 0 14px; }
  .raster { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 340px), 1fr)); gap: 18px; }
  figure { margin: 0; background: var(--flaeche); border: 1px solid var(--linie); border-radius: 10px;
    box-shadow: var(--schatten); overflow: hidden; display: flex; flex-direction: column; }
  figure a { display: block; background: #fff; border-bottom: 1px solid var(--linie); }
  figure img { display: block; width: 100%; height: 260px; object-fit: cover; object-position: top; }
  figure.mobil img { height: 360px; object-fit: contain; background: var(--grund); }
  figcaption { padding: 12px 14px 14px; display: grid; gap: 4px; }
  figcaption span { color: var(--leise); font-size: 0.93rem; }
  footer { color: var(--leise); font-size: 0.9rem; padding-top: 36px; padding-bottom: 48px; }
  footer a { color: var(--akzent); }
</style>
</head>
<body>
<header>
  <h1>Vermieter.OS · Vorschau</h1>
  <p class="unter">Bildschirmfotos aus einem automatischen Rundgang durch die echte Anwendung. Alle Daten sind
  Musterdaten, es gibt keine echten Personen, Adressen oder Verträge. Ein Klick auf ein Bild öffnet es in voller Größe.</p>
  <p class="stand">Stand: ${h(stand.erstellt)} · Branch <code>${h(stand.ref)}</code> · Commit
  <a href="${repoUrl}/commit/${h(stand.commit)}"><code>${h(kurz)}</code></a></p>
  <nav>${bereiche.map((b, i) => `<a href="#b${i + 1}">${h(b)}</a>`).join('')}</nav>
</header>
<main>${abschnitte}
</main>
<footer>
  Erzeugt von <a href="${repoUrl}/blob/main/.github/workflows/vorschau.yml">.github/workflows/vorschau.yml</a>.
  Plan: <a href="${repoUrl}/blob/main/docs/PLAN.md">docs/PLAN.md</a> ·
  Betrieb: <a href="${repoUrl}/blob/main/docs/BETRIEB.md">docs/BETRIEB.md</a>
</footer>
</body>
</html>
`
  writeFileSync(join(ausgabe, 'index.html'), html)
}
