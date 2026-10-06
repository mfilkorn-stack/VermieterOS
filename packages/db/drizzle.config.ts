import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: ['./src/schema/index.ts', './src/schema/auth.ts'],
  out: './migrations',
  dbCredentials: {
    url:
      process.env['DATABASE_URL_OWNER'] ??
      'postgres://vermieteros_owner:owner@127.0.0.1:5432/vermieteros',
  },
  strict: true,
  verbose: true,
})
