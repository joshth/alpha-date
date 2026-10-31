import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { getDb } from "@/lib/_stubs/db"
import { safetyEvents } from "@/lib/_stubs/schema"
import { createSafetyActivityReader, readSafetyActivity } from "@/lib/safety/activity"
import type { SafetyEvent } from "@/lib/safety/events"
import { getSafetyActivity } from "@/app/lab/actions"

process.env.SKIP_SEED = "true"
const period = { from: "2026-10-30T00:00:00.000Z", to: "2026-10-30T01:00:00.000Z" }
const empty = {
  period, evaluated: 0, allowed: 0, blocked: 0, blockedRate: null,
  byOutcome: { safe: 0, refuse: 0, safeguarding: 0, gentle_support: 0 },
}

async function seed(entries: { outcome: SafetyEvent["outcome"]; at?: string; categories?: SafetyEvent["categories"] }[] = []) {
  const db = await getDb()
  await db.delete(safetyEvents)
  if (entries.length) await db.insert(safetyEvents).values(entries.map(entry => ({
    outcome: entry.outcome, categories: entry.categories ?? [], recordedAt: new Date(entry.at ?? "2026-10-30T00:30:00.000Z"),
  })))
  return db
}

test("an empty period returns explicit zero outcomes and an undefined rate", async () => {
  await seed()
  assert.deepEqual(await readSafetyActivity(period), empty)
})

test("mixed outcomes count each stored verdict once, including mult-category events", async () => {
  await seed([
    { outcome: "safe" }, { outcome: "safe" }, { outcome: "refuse" },
    { outcome: "safeguarding", categories: ["suicide_self_harm", "violence_threat"] },
    { outcome: "gentle_support" },
  ])
  assert.deepEqual(await readSafetyActivity(period), {
    period, evaluated: 5, allowed: 2, blocked: 3, blockedRate: 3 / 5,
    byOutcome: { safe: 2, refuse: 1, safeguarding: 1, gentle_support: 1 },
  })
})

test("a period includes its start and excludes its end and outside records", async () => {
  await seed([
    { outcome: "refuse", at: "2026-10-29T23:59:59.999Z" },
    { outcome: "safe", at: period.from },
    { outcome: "safeguarding", at: "2026-10-30T00:59:59.999Z" },
    { outcome: "refuse", at: period.to },
    { outcome: "refuse", at: "2026-10-31T00:00:00.000Z" },
  ])
  const summary = await readSafetyActivity(period)
  assert.equal(summary.evaluated, 2)
  assert.equal(summary.allowed, 1)
  assert.equal(summary.blocked, 1)
  assert.equal(summary.byOutcome.refuse, 0)
})

test("adjacent periods do not double count their shared boundary", async () => {
  await seed([{ outcome: "safe", at: period.from }, { outcome: "refuse", at: period.to }])
  const first = await readSafetyActivity(period)
  const second = await readSafetyActivity({ from: period.to, to: "2026-10-30T02:00:00.000Z" })
  assert.equal(first.evaluated + second.evaluated, 2)
  assert.equal(first.byOutcome.safe, 1)
  assert.equal(second.byOutcome.refuse, 1)
})

test("explicit timezone offsets produce the same UTC summary", async () => {
  await seed([{ outcome: "safe" }])
  assert.deepEqual(await readSafetyActivity({ from: "2026-10-30T11:00:00+11:00", to: "2026-10-30T12:00:00+11:00" }),
    await readSafetyActivity(period))
})

for (const [name, invalid] of [
  ["missing timezone", { ...period, from: "2026-10-30T00:00:00" }],
  ["invalid date", { ...period, from: "2026-02-30T00:00:00Z" }],
  ["empty date", { ...period, from: "" }],
  ["reversed period", { from: period.to, to: period.from }],
  ["equal instants", { from: period.from, to: "2026-10-30T11:00:00+11:00" }],
  ["untrusted text", { ...period, from: "private fixture; SELECT * FROM terms" }],
  ["non-string date", { ...period, from: new Date(period.from) }],
  ["extra field", { ...period, userId: "private fixture" }],
] as const) {
  test(`${name} is rejected before connecting without echoing input`, async () => {
    let connections = 0
    const read = createSafetyActivityReader(async () => { connections++; return getDb() })
    await assert.rejects(read(invalid as unknown as typeof period), {
      message: "Choose a valid time period with the start before the end.",
    })
    assert.equal(connections, 0)
  })
}

test("reading summaries leaves events unchanged and returns no individual records or savings claims", async () => {
  const db = await seed([{ outcome: "safe", categories: ["suicide_self_harm"] }])
  const before = await db.select().from(safetyEvents)
  const summary = await readSafetyActivity(period)
  assert.deepEqual(await db.select().from(safetyEvents), before)
  assert.deepEqual(Object.keys(summary).sort(), ["period", "evaluated", "allowed", "blocked", "blockedRate", "byOutcome"].sort())
  assert.equal(JSON.stringify(summary).includes("suicide_self_harm"), false)
  assert.equal("discoveryCallsAvoided" in summary, false)
  assert.equal("estimatedSavings" in summary, false)
})

test("database failure is a neutral error rather than a zero-activity report; the next read recovers", async () => {
  const db = await seed()
  let attempts = 0
  const read = createSafetyActivityReader(async () => {
    if (++attempts === 1) throw new Error("private connection details")
    return db
  })
  await assert.rejects(read(period), { message: "Could not load safety activity. Please try again." })
  assert.deepEqual(await read(period), empty)
})

test("unrecognised stored outcomes fail explicitly instead of silently undercounting", async () => {
  const db = await seed()
  await db.insert(safetyEvents).values({ outcome: "private invalid label" as SafetyEvent["outcome"], categories: [], recordedAt: new Date(period.from) })
  await assert.rejects(readSafetyActivity(period), { message: "Could not load safety activity. Please try again." })
})

test("reviewer server action returns the aggregated period summary", async () => {
  await seed([{ outcome: "safe" }, { outcome: "refuse" }])
  const summary = await getSafetyActivity(period.from, period.to)
  assert.equal(summary.evaluated, 2)
  assert.equal(summary.allowed, 1)
  assert.equal(summary.blocked, 1)
  assert.deepEqual(summary.period, period)
})
