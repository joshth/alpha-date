import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { PGlite } from "@electric-sql/pglite"
import { drizzle } from "drizzle-orm/pglite"
import { migrate } from "drizzle-orm/pglite/migrator"
import { sql } from "drizzle-orm"
import { getDb, type Db } from "@/lib/_stubs/db"
import * as schema from "@/lib/_stubs/schema"
import { createSafetyIncident, type IncidentInput, type SafetyIncident } from "@/lib/safety/incidents"
import { createSafetyIncidentStore, storeSafetyIncident } from "@/lib/safety/incident-store"

process.env.SKIP_SEED = "true"
const error = { message: "Could not save the safety incident." }
const now = new Date("2026-11-05T01:02:03.456Z")
const input: IncidentInput = {
  query: "  Synthetic 😟 fixture\r\nExact text stays intact.  ", surface: "search", triageLevel: "high",
  verdict: { action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"], decidedBy: "rules", reason: "synthetic" },
}
const incident = () => createSafetyIncident(input, now)
async function reset() {
  const db = await getDb()
  await db.delete(schema.safetyIncidents)
  return db
}

test("migration creates only approved incident columns and a timestamp index", async () => {
  const db = await reset()
  const columns = await db.execute(sql`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'safety_incidents' order by ordinal_position`) as { rows: { column_name: string }[] }
  assert.deepEqual(columns.rows.map(row => row.column_name), ["reference_id", "query_text", "surface", "crisis", "categories", "recorded_at_utc", "recorded_at_sydney", "local_timezone", "triage_level", "status", "alert_status"])
  const indexes = await db.execute(sql`select indexname from pg_indexes where tablename = 'safety_incidents'`) as { rows: { indexname: string }[] }
  assert.ok(indexes.rows.some(row => row.indexname === "safety_incidents_recorded_at_idx"))
  assert.deepEqual(await db.select().from(schema.safetyIncidents), [])
})

for (const [surface, crisis] of [["search", "self_harm"], ["suggestion", "harm_to_others"]] as const) {
  test(`${surface} incident round-trips exact text, reference, categories and both timestamps`, async () => {
    const db = await reset()
    const record = createSafetyIncident({ ...input, surface, verdict: { ...input.verdict, crisis,
      categories: crisis === "self_harm" ? ["suicide_self_harm"] : ["violence_threat"] } }, now)
    await storeSafetyIncident(record)
    const [row] = await db.select().from(schema.safetyIncidents)
    assert.deepEqual({ ...row, recordedAtUtc: row.recordedAtUtc.toISOString() }, record)
  })
}

test("supplied medium and moderation-only states are stored without inventing triage or sending alerts", async () => {
  const db = await reset()
  const medium = createSafetyIncident({ ...input, triageLevel: "medium" }, now)
  const closed = createSafetyIncident({ ...input, triageLevel: "moderation_only", verdict: { ...input.verdict, crisis: null, decidedBy: "moderation" } }, now)
  await storeSafetyIncident(medium)
  await storeSafetyIncident(closed)
  const rows = await db.select().from(schema.safetyIncidents)
  assert.deepEqual(rows.map(row => [row.triageLevel, row.status, row.alertStatus]), [["medium", "open", "pending"], ["moderation_only", "closed", "not_required"]])
})

test("incident storage leaves anonymous analytics, terms and suggestions separate", async () => {
  const db = await reset()
  await storeSafetyIncident(incident())
  for (const table of [schema.safetyEvents, schema.termEvents, schema.terms, schema.termFeedback]) {
    assert.deepEqual(await db.select().from(table), [])
  }
})

test("identifiers and telemetry fields are rejected before connecting", async () => {
  let connections = 0
  const store = createSafetyIncidentStore(async () => { connections++; throw new Error("must not connect") })
  for (const key of ["userId", "ip", "userIp", "sessionId", "deviceId", "deviceTelemetry"]) {
    await assert.rejects(store({ ...incident(), [key]: "private fixture" } as SafetyIncident), error)
  }
  assert.equal(connections, 0)
})

test("malformed and inconsistent records fail before connecting without exposing values", async () => {
  let connections = 0
  const store = createSafetyIncidentStore(async () => { connections++; throw new Error("must not connect") })
  const original = incident()
  for (const changes of [
    { referenceId: "private fixture" }, { query: " \n " }, { surface: "private fixture" },
    { crisis: "private fixture" }, { categories: ["private fixture"] }, { triageLevel: "private fixture" },
    { status: "closed" }, { alertStatus: "sent" }, { localTimezone: "UTC" },
    { recordedAtUtc: "invalid" }, { recordedAtSydney: original.recordedAtUtc },
    { recordedAtSydney: "2026-06-01T11:02:03.456+10:00" },
    { triageLevel: "moderation_only", status: "closed", alertStatus: "not_required" },
    { triageLevel: "moderation_only", crisis: null, status: "closed", alertStatus: "pending" },
  ]) await assert.rejects(store({ ...original, ...changes } as SafetyIncident), error)
  assert.equal(connections, 0)
})

test("a duplicate reference cannot overwrite an existing incident", async () => {
  const db = await reset()
  const record = incident()
  await storeSafetyIncident(record)
  await assert.rejects(storeSafetyIncident({ ...record, query: "Changed synthetic content." }), error)
  const rows = await db.select().from(schema.safetyIncidents)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].query, record.query)
})

test("connection failures are sanitised and a later explicit attempt can recover", async t => {
  const db = await reset()
  const logs: unknown[] = []
  t.mock.method(console, "error", (...args: unknown[]) => { logs.push(args) })
  let attempts = 0
  const store = createSafetyIncidentStore(async () => {
    if (++attempts === 1) throw new Error("private connection details")
    return db
  })
  const record = incident()
  await assert.rejects(store(record), err => {
    assert.equal((err as Error).message, error.message)
    assert.equal((err as Error).cause, undefined)
    return true
  })
  await store(record)
  assert.equal(attempts, 2)
  assert.equal((await db.select().from(schema.safetyIncidents)).length, 1)
  assert.deepEqual(logs, [])
})

test("insert exceptions do not expose private text or database details", async () => {
  const db = { insert: () => ({ values: async () => { throw new Error(input.query) } }) } as unknown as Db
  await assert.rejects(createSafetyIncidentStore(async () => db)(incident()), error)
})

test("the validated record is snapshotted before awaiting the connection", async () => {
  const db = await reset()
  let release!: () => void
  const pause = new Promise<void>(resolve => { release = resolve })
  const store = createSafetyIncidentStore(async () => { await pause; return db })
  const record = incident()
  const expected = structuredClone(record)
  const saved = store(record)
  record.query = "Changed after validation."
  record.categories.push("violence_threat")
  release()
  await saved
  const [row] = await db.select().from(schema.safetyIncidents)
  assert.deepEqual({ ...row, recordedAtUtc: row.recordedAtUtc.toISOString() }, expected)
})

for (const stage of ["connection", "insert"] as const) {
  test(`a slow ${stage} bounds caller wait without retrying or cancelling a late write`, async t => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let release!: () => void, finish!: () => void, writes = 0
    const pause = new Promise<void>(resolve => { release = resolve })
    const done = new Promise<void>(resolve => { finish = resolve })
    const db = { insert: () => ({ values: async () => {
      if (stage === "insert") await pause
      writes++; finish()
    } }) } as unknown as Db
    const store = createSafetyIncidentStore(async () => { if (stage === "connection") await pause; return db })
    const rejected = assert.rejects(store(incident()), error)
    await Promise.resolve(); await Promise.resolve()
    t.mock.timers.tick(1000)
    await rejected
    assert.equal(writes, 0)
    release(); await done
    assert.equal(writes, 1)
  })
}

test("invalid timeout bounds fail during configuration", () => {
  for (const value of [0, -1, NaN, Infinity]) assert.throws(() => createSafetyIncidentStore(getDb, value), /Invalid incident store timeout/)
})

test("upgrading the prior migration history preserves existing data and can run twice", async () => {
  const folder = mkdtempSync(path.join(tmpdir(), "alpha-date-incident-upgrade-"))
  const client = new PGlite("memory://")
  const db = drizzle(client, { schema })
  try {
    mkdirSync(path.join(folder, "meta"))
    const journal = JSON.parse(readFileSync("drizzle/meta/_journal.json", "utf8"))
    const entries = journal.entries.filter((entry: { idx: number }) => entry.idx < 5)
    for (const entry of entries) writeFileSync(path.join(folder, entry.tag + ".sql"), readFileSync("drizzle/" + entry.tag + ".sql"))
    writeFileSync(path.join(folder, "meta/_journal.json"), JSON.stringify({ ...journal, entries }))
    await migrate(db, { migrationsFolder: folder })
    await db.insert(schema.terms).values({ term: "Legacy Fixture", termLower: "legacy fixture", termKey: "legacyfixture", definition: "Synthetic existing definition." })
    await db.insert(schema.safetyEvents).values({ outcome: "safe", categories: [], recordedAt: now })
    const beforeTerms = await db.select().from(schema.terms)
    const beforeEvents = await db.select().from(schema.safetyEvents)
    await migrate(db, { migrationsFolder: "drizzle" })
    const record = incident()
    await createSafetyIncidentStore(async () => db as unknown as Db)(record)
    await migrate(db, { migrationsFolder: "drizzle" })
    assert.deepEqual(await db.select().from(schema.terms), beforeTerms)
    assert.deepEqual(await db.select().from(schema.safetyEvents), beforeEvents)
    const [row] = await db.select().from(schema.safetyIncidents)
    assert.deepEqual({ ...row, recordedAtUtc: row.recordedAtUtc.toISOString() }, record)
  } finally {
    await client.close()
    assert.equal(path.dirname(folder), path.resolve(tmpdir()))
    rmSync(folder, { recursive: true, force: true })
  }
})
