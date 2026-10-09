import "server-only"
import { mkdirSync } from "node:fs"
import path from "node:path"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import * as schema from "./schema"
import { seedIfEmpty } from "./seed"

// STUDENT-FACING STUB DATABASE — not the production client.
//
// - DATABASE_URL unset (default): embedded PGlite (real Postgres compiled to
//   WASM) stored in ./.data/pglite, migrated from ./drizzle and seeded with
//   synthetic data on first use. `pnpm db:reset` wipes it.
// - DATABASE_URL set: your OWN hosted Postgres (e.g. a Neon free-tier project,
//   for your Vercel sandbox). Run `pnpm db:migrate` first. Never production.

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>

const globalForDb = globalThis as unknown as { __alphaDateDb?: Promise<Db> }

async function connect(): Promise<Db> {
  const url = process.env.DATABASE_URL?.trim()
  if (url) {
    const { neon } = await import("@neondatabase/serverless")
    const { drizzle } = await import("drizzle-orm/neon-http")
    const db = drizzle(neon(url), { schema }) as unknown as Db
    await seedIfEmpty(db)
    return db
  }

  const { PGlite } = await import("@electric-sql/pglite")
  const { drizzle } = await import("drizzle-orm/pglite")
  const { migrate } = await import("drizzle-orm/pglite/migrator")
  // PGLITE_DATA_DIR=memory:// gives a throwaway in-memory database (used by tests).
  const dataDir = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite")
  // PGlite creates its own directory but not missing parents.
  if (!dataDir.includes("://")) mkdirSync(path.dirname(dataDir), { recursive: true })
  const client = new PGlite(dataDir)
  const db = drizzle(client, { schema })
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") })
  if (process.env.SKIP_SEED !== "true") await seedIfEmpty(db as unknown as Db)
  return db as unknown as Db
}

/** Shared connection (cached on globalThis so dev hot-reload doesn't reopen PGlite). */
export function getDb(): Promise<Db> {
  if (!globalForDb.__alphaDateDb) {
    globalForDb.__alphaDateDb = connect().catch((error) => {
      globalForDb.__alphaDateDb = undefined
      throw error
    })
  }
  return globalForDb.__alphaDateDb
}

export { schema }
