import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { backfillTermKeys, type Db } from "@/lib/_stubs/db"
import { normaliseSuggestion, NORMALISER_VERSION } from "@/lib/normalise"
import * as schema from "@/lib/_stubs/schema"

for (const history of ["fresh", "starter", "main", "safety"] as const) {
  test(`merged migrations preserve data and can run twice after ${history}`, async () => {
    const client = new PGlite("memory://")
    const db = drizzle(client, { schema })
    const folder = mkdtempSync(path.join(tmpdir(), "alpha-date-migration-"))
    try {
      const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"))
      if (history !== "fresh") {
        mkdirSync(path.join(folder, "meta"))
        const entries = history === "main" ? journal.entries.slice(0, 3) : journal.entries.slice(0, 1)
        for (const entry of entries) writeFileSync(path.join(folder, `${entry.tag}.sql`), readFileSync(`drizzle/${entry.tag}.sql`))
        if (history === "safety") {
          entries.push({ idx: 2, version: "7", when: 1793239460940, tag: "0002_safety_events", breakpoints: true })
          writeFileSync(path.join(folder, "0002_safety_events.sql"), readFileSync("tests/fixtures/legacy-safety-events.sql"))
        }
        writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries }))
        await migrate(db, { migrationsFolder: folder })
        for (const term of ["Brain-Rottt!!!", "CAFÉ", "6 7"]) {
          if (history === "main") {
            await client.query(`insert into terms (id, term, term_lower, term_key, key_version, definition) values ($1, $2, $3, $4, $5, $6)`,
              [term, term, term.toLowerCase(), normaliseSuggestion(term), NORMALISER_VERSION, "Synthetic legacy definition."])
          } else {
            await client.query(`insert into terms (id, term, term_lower, definition) values ($1, $2, $3, $4)`,
              [term, term, term.toLowerCase(), "Synthetic legacy definition."])
          }
        }
        if (history === "safety") await client.exec(`insert into safety_events values ('refuse', '[]', '2026-10-29T01:00:00Z')`)
      }
      await migrate(db, { migrationsFolder: "drizzle" })
      await backfillTermKeys(db as unknown as Db)
      const first = await db.select().from(schema.terms)
      assert.equal(first.length, history === "fresh" ? 0 : 3)
      for (const row of first) {
        assert.equal(row.termKey, normaliseSuggestion(row.term))
        assert.equal(row.keyVersion, NORMALISER_VERSION)
        assert.equal(row.definition, "Synthetic legacy definition.")
      }
      const events = await db.select().from(schema.safetyEvents)
      assert.equal(events.length, history === "safety" ? 1 : 0)
      if (events.length) assert.equal(events[0].recordedAt.toISOString(), "2026-10-29T01:00:00.000Z")
      await migrate(db, { migrationsFolder: "drizzle" })
      await backfillTermKeys(db as unknown as Db)
      assert.deepEqual(await db.select().from(schema.terms), first)
      assert.deepEqual(await db.select().from(schema.safetyEvents), events)
      const columns = await client.query<{ column_name: string }>(`select column_name from information_schema.columns where table_name = 'safety_events' order by ordinal_position`)
      assert.deepEqual(columns.rows.map(row => row.column_name), ["outcome", "categories", "recorded_at"])
    } finally {
      await client.close()
      assert.equal(path.dirname(folder), path.resolve(tmpdir()))
      rmSync(folder, { recursive: true, force: true })
    }
  })
}
