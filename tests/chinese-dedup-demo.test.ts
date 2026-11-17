import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { seedIfEmpty } from "@/lib/_stubs/seed"
import * as schema from "@/lib/_stubs/schema"
import { similarityGraph } from "@/lib/dedup/graph"
import { CHINESE_NUMBER_EXAMPLES } from "@/lib/normalise"

test("existing demo databases gain Chinese search terms and connected graph examples once", async () => {
  const client = new PGlite("memory://")
  const db = drizzle(client, { schema })
  try {
    await migrate(db, { migrationsFolder: "drizzle" })
    await db.insert(schema.terms).values({ term: "Existing", termLower: "existing", termKey: "existing", definition: "Keep me." })
    await seedIfEmpty(db)
    await seedIfEmpty(db)
    const terms = await db.select().from(schema.terms)
    const rows = await db.select().from(schema.termFeedback)
    const graph = similarityGraph(rows, terms.filter((t) => t.status === "published").map((t) => t.term))
    for (const { number, phrase } of CHINESE_NUMBER_EXAMPLES) {
      assert.equal(terms.filter((t) => t.term === phrase && t.status === "published").length, 1, phrase)
      assert.equal(rows.filter((r) => r.suggestedTerm === number && r.count > 0).length, 1, number)
      assert.ok(graph.edges.some((e) => e.id === [number, phrase].sort().join("|") && e.reason === "same_key"), number)
    }
    assert.equal(terms.find((t) => t.term === "Existing")?.definition, "Keep me.")
  } finally {
    await client.close()
  }
})
