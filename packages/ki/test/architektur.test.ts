import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/** ADR 0005: Das SDK wird nur in packages/ki importiert. Ersetzt eine Lint-Regel. */
const WURZEL = resolve(import.meta.dirname, '../../..')
const ORDNER = ['apps', 'packages']
const AUSNAHMEN = new Set(['node_modules', '.next', 'dist', 'test-results', 'vorschau-ausgabe'])

function dateien(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    if (AUSNAHMEN.has(n)) return []
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return dateien(p)
    return /\.(ts|tsx|js|mjs)$/.test(n) ? [p] : []
  })
}

describe('Architektur', () => {
  it('importiert @anthropic-ai/sdk nur in packages/ki', () => {
    const verstoesse = ORDNER.flatMap((o) => dateien(join(WURZEL, o)))
      .map((p) => relative(WURZEL, p))
      .filter((p) => !p.startsWith('packages/ki/'))
      .filter((p) => readFileSync(join(WURZEL, p), 'utf8').includes('@anthropic-ai/sdk'))
    expect(verstoesse).toEqual([])
  })
})
