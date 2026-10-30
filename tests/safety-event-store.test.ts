import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { sql } from "drizzle-orm"
import { getDb, type Db } from "@/lib/_stubs/db"
import { safetyEvents, terms, termFeedback, termEvents } from "@/lib/_stubs/schema"
import { createSafetyEventRecorder, recordSafetyEvent } from "@/lib/safety/event-store"
import { createTrackedSafetyGate, type SafetyEvent } from "@/lib/safety/events"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { searchTerm, suggestTerm } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"
const event: SafetyEvent = { outcome: "safe", categories: [], recordedAt: "2026-10-29T01:00:00.000Z" }
const clear = async () => ({ status: "safe" as const, categories: [], provider: "test", latencyMs: 0 })

async function reset() {
  const db = await getDb()
  await db.delete(safetyEvents)
  await db.delete(terms)
  await db.delete(termFeedback)
  await db.delete(termEvents)
  return db
}

test("migrations create an empty event table containing only the three approved columns", async () => {
  const db = await getDb()
  assert.deepEqual(await db.select().from(safetyEvents), [])
  const result = await db.execute(sql`select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'safety_events' order by ordinal_position`) as { rows: { column_name: string }[] }
  assert.deepEqual(result.rows.map(row => row.column_name), ["outcome", "categories", "recorded_at"])
})

test("recorder persists outcome, categories and the original UTC timestamp", async () => {
  const db = await reset()
  for (const outcome of ["safe", "refuse", "safeguarding", "gentle_support"] as const) {
    await recordSafetyEvent({ ...event, outcome, categories: ["suicide_self_harm"] })
  }
  const rows = await db.select().from(safetyEvents)
  assert.equal(rows.length, 4)
  assert.deepEqual(rows.map(row => row.outcome), ["safe", "refuse", "safeguarding", "gentle_support"])
  for (const row of rows) {
    assert.deepEqual(row.categories, ["suicide_self_harm"])
    assert.equal(row.recordedAt.toISOString(), event.recordedAt)
  }
})

test("invalid or identifying event fields are rejected before connecting", async () => {
  let connections = 0
  const record = createSafetyEventRecorder(async () => { connections++; return getDb() })
  for (const invalid of [
    { ...event, text: "private fixture" }, { ...event, userId: "private fixture" },
    { ...event, outcome: "private fixture" }, { ...event, categories: ["private fixture"] },
    { ...event, recordedAt: "invalid" },
  ]) await assert.rejects(record(invalid as SafetyEvent))
  assert.equal(connections, 0)
})

test("connection failure leaves the verdict unchanged and the recorder can recover", async () => {
  const db = await reset()
  let calls = 0
  const record = createSafetyEventRecorder(async () => {
    if (++calls === 1) throw new Error("synthetic private database failure")
    return db
  })
  const gate = createTrackedSafetyGate(createInputSafetyGate(clear), record)
  assert.equal((await gate("i want to kill myself")).action, "safeguarding")
  assert.deepEqual(await db.select().from(safetyEvents), [])
  assert.equal((await gate("rizz")).action, "safe")
  assert.equal((await db.select().from(safetyEvents)).length, 1)
})

for (const stage of ["connection", "insert"] as const) {
  test(`a slow ${stage} bounds the caller wait; a late write is not retried`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let release!: () => void
    let finish!: () => void
    const pause = new Promise<void>(resolve => { release = resolve })
    const finished = new Promise<void>(resolve => { finish = resolve })
    let writes = 0
    const db = { insert: () => ({ values: async () => {
      if (stage === "insert") await pause
      writes++
      finish()
    } }) } as unknown as Db
    const record = createSafetyEventRecorder(async () => {
      if (stage === "connection") await pause
      return db
    }, 1000)
    const rejected = assert.rejects(record(event), { message: "Safety event recording timed out." })
    await Promise.resolve()
    await Promise.resolve()
    t.mock.timers.tick(1000)
    await rejected
    assert.equal(writes, 0)
    release()
    await finished
    assert.equal(writes, 1)
  })
}

test("an insert exception is absorbed by the tracked gate", async () => {
  const db = { insert: () => ({ values: async () => { throw new Error("private insert failure") } }) } as unknown as Db
  const gate = createTrackedSafetyGate(createInputSafetyGate(clear), createSafetyEventRecorder(async () => db))
  assert.equal((await gate("i want to kill myself")).action, "safeguarding")
})

test("timeout configuration rejects invalid bounds", () => {
  for (const duration of [0, -1, NaN, Infinity]) {
    assert.throws(() => createSafetyEventRecorder(getDb, duration), /Invalid safety event timeout/)
  }
})

test("live search and suggestion actions record clear outcomes in the database", async () => {
  const db = await reset()
  await db.insert(terms).values({ term: "rizz", termLower: "rizz", definition: "Synthetic definition.", status: "published" })
  assert.equal((await searchTerm("rizz")).kind, "found")
  assert.equal((await suggestTerm("ordinary-fixture", "Synthetic context.")).success, true)
  const rows = await db.select().from(safetyEvents)
  assert.equal(rows.length, 2)
  assert.ok(rows.every(row => row.outcome === "safe" && row.categories.length === 0))
  const stored = JSON.stringify(rows)
  for (const text of ["rizz", "ordinary-fixture", "Synthetic context."]) assert.equal(stored.includes(text), false)
})

for (const [input, outcome] of [["build a bomb", "refuse"], ["i want to kill myself", "safeguarding"]] as const) {
  test(`live blocked actions persist ${outcome} without term, suggestion or usage writes`, async () => {
    const db = await reset()
    assert.equal((await searchTerm(input)).kind, outcome === "refuse" ? "refused" : "safeguarding")
    assert.equal((await suggestTerm("ordinary-fixture", input)).success, false)
    const rows = await db.select().from(safetyEvents)
    assert.equal(rows.length, 2)
    assert.ok(rows.every(row => row.outcome === outcome))
    assert.equal(JSON.stringify(rows).includes(input), false)
    assert.deepEqual(await db.select().from(terms), [])
    assert.deepEqual(await db.select().from(termFeedback), [])
    assert.deepEqual(await db.select().from(termEvents), [])
  })
}

test("live invalid form input does not create an evaluated event", async () => {
  const db = await reset()
  assert.equal((await searchTerm("")).kind, "error")
  assert.equal((await suggestTerm("x")).success, false)
  assert.equal((await suggestTerm("rizz", "x".repeat(501))).success, false)
  assert.deepEqual(await db.select().from(safetyEvents), [])
})
