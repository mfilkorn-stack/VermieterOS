/**
 * Erzeugt src/schema/auth.ts aus der Better-Auth-Konfiguration.
 * Entspricht `better-auth generate` für Drizzle, aber ohne CLI-Versionsdrift.
 * Aufruf: pnpm --filter @vermieteros/db auth:schema
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { getAuthTablesWithResolvedIndexes } from '@better-auth/core/db/internal'
import type { DBFieldAttribute } from '@better-auth/core/db'
import { magicLink, organization, twoFactor } from 'better-auth/plugins'

// Muss mit apps/web/lib/auth.ts übereinstimmen (Plugins bestimmen die Tabellen).
const { tables, indexesByTable } = getAuthTablesWithResolvedIndexes({
  plugins: [
    organization({ creatorRole: 'owner' }),
    twoFactor({ issuer: 'Vermieter.OS' }),
    magicLink({ sendMagicLink: async () => {} }),
  ],
})

const imports = new Set(['pgSchema', 'text'])

/** Spaltennamen in snake_case, wie im übrigen Schema. Die JS-Schlüssel bleiben die Better-Auth-Feldnamen. */
function snake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => '_' + c.toLowerCase())
}

function spalte(name: string, f: DBFieldAttribute): string {
  const col = snake(f.fieldName ?? name)
  let s: string
  if (Array.isArray(f.type)) {
    s = `text(${q(col)})`
  } else if (f.type === 'string') {
    s = `text(${q(col)})`
  } else if (f.type === 'number') {
    imports.add(f.bigint ? 'bigint' : 'integer')
    s = f.bigint ? `bigint(${q(col)}, { mode: 'number' })` : `integer(${q(col)})`
  } else if (f.type === 'boolean') {
    imports.add('boolean')
    s = `boolean(${q(col)})`
  } else if (f.type === 'date') {
    imports.add('timestamp')
    s = `timestamp(${q(col)}, { withTimezone: true })`
  } else if (f.type === 'json') {
    imports.add('jsonb')
    s = `jsonb(${q(col)})`
  } else if (f.type === 'string[]') {
    s = `text(${q(col)}).array()`
  } else if (f.type === 'number[]') {
    imports.add('integer')
    s = `integer(${q(col)}).array()`
  } else {
    throw new Error(`unbekannter Feldtyp ${String(f.type)} für ${name}`)
  }
  if (f.required) s += '.notNull()'
  if (f.unique) s += '.unique()'
  if (f.defaultValue !== undefined && typeof f.defaultValue !== 'function') {
    const d = f.defaultValue
    if (d instanceof Date) s += '.defaultNow()'
    else if (typeof d === 'string' || typeof d === 'number' || typeof d === 'boolean')
      s += `.default(${JSON.stringify(d)})`
  }
  if (f.references) {
    const ziel = modelKey(f.references.model)
    const onDelete = f.references.onDelete ? `, { onDelete: ${q(f.references.onDelete)} }` : ''
    s += `.references(() => ${ziel}.${f.references.field}${onDelete})`
  }
  return `  ${name}: ${s},`
}

function modelKey(modelName: string): string {
  for (const [key, t] of Object.entries(tables))
    if (t.modelName === modelName || key === modelName) return key
  throw new Error(`Modell ${modelName} nicht gefunden`)
}

function q(s: string): string {
  return `'${s}'`
}

const reihenfolge = Object.entries(tables).sort((a, b) => (a[1].order ?? 1e9) - (b[1].order ?? 1e9))
const bloecke: string[] = []
const keys: string[] = []

for (const [key, t] of reihenfolge) {
  keys.push(key)
  const felder = [`  id: text('id').primaryKey(),`]
  for (const [name, f] of Object.entries(t.fields)) felder.push(spalte(name, f))
  const idx = indexesByTable.get(t.modelName) ?? indexesByTable.get(key) ?? []
  let indexTeil = ''
  if (idx.length > 0) {
    imports.add('index')
    imports.add('uniqueIndex')
    const zeilen = idx.map((i, n) => {
      const r = i as unknown as { fields?: readonly string[]; name?: string; unique?: boolean }
      const fn = r.unique ? 'uniqueIndex' : 'index'
      const nm = r.name ?? `${t.modelName}_${(r.fields ?? []).join('_')}_${n}`
      const cols = (r.fields ?? []).map((f) => `t.${f}`).join(', ')
      return `    ${fn}(${q(nm)}).on(${cols}),`
    })
    indexTeil = `,\n  (t) => [\n${zeilen.join('\n')}\n  ]`
  }
  bloecke.push(
    `export const ${key} = authSchema.table(\n  ${q(snake(t.modelName))},\n  {\n${felder.join('\n')}\n  }${indexTeil},\n)`,
  )
}

const out = `// GENERIERT von scripts/auth-schema.ts, nicht von Hand ändern.
// Better-Auth-Tabellen im Schema \`auth\`. Kein RLS: Zugehörigkeit zu Mandanten läuft über \`member\`.
import { ${[...imports].sort().join(', ')} } from 'drizzle-orm/pg-core'

export const authSchema = pgSchema('auth')

${bloecke.join('\n\n')}
`

const ziel = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'schema', 'auth.ts')
writeFileSync(ziel, out)
console.log(`geschrieben: ${ziel} (${keys.join(', ')})`)
