import assert from "node:assert/strict"
import test from "node:test"
import { eq } from "drizzle-orm"
import { searchTerm, suggestTerm } from "@/app/lab/actions"
import { getDb, schema } from "@/lib/_stubs/db"
import type { SafetyVerdict } from "@/lib/safety/gate"
import { readRecentSafetyIncidentDetails, readRecentSafetyIncidents } from "@/lib/safety/incident-store"
import { createIncidentSafetyCheck } from "@/lib/safety/incident-workflow"

const demoEnv = { MOCK_LLM: "true", DATABASE_URL: "" }
const crisis: SafetyVerdict = {
  action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"],
  decidedBy: "rules", reason: "crisis:self_harm",
}

test("incident workflow records by default regardless of database or legacy environment flag", async () => {
  const previousUrl = process.env.DATABASE_URL
  const previousFlag = process.env.SAFETY_INCIDENT_DEMO
  try {
    for (const databaseUrl of [undefined, "postgresql://example.test/db"]) {
      if (databaseUrl === undefined) delete process.env.DATABASE_URL
      else process.env.DATABASE_URL = databaseUrl
      for (const flag of [undefined, "false"]) {
        if (flag === undefined) delete process.env.SAFETY_INCIDENT_DEMO
        else process.env.SAFETY_INCIDENT_DEMO = flag
        const saved: string[] = []
        const check = createIncidentSafetyCheck(async () => crisis, {
          save: async record => { saved.push(record.referenceId) },
          notify: () => {}, recordAlertResult: async () => {},
        })
        const verdict = await check("synthetic crisis", "search", "synthetic crisis")
        assert.ok(verdict.incidentReference)
        assert.deepEqual(saved, [verdict.incidentReference])
      }
    }
  } finally {
    if (previousUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previousUrl
    if (previousFlag === undefined) delete process.env.SAFETY_INCIDENT_DEMO
    else process.env.SAFETY_INCIDENT_DEMO = previousFlag
  }
})

test("storage failure preserves the original support verdict and skips alerting", async () => {
  const calls: string[] = []
  const check = createIncidentSafetyCheck(async () => crisis, {
    enabled: () => true,
    save: async () => { throw new Error("database offline") },
    notify: () => { calls.push("notify") },
    recordAlertResult: async () => { calls.push("update") },
  })
  assert.equal(await check("example", "search", "  example "), crisis)
  assert.deepEqual(calls, [])
})

test("an alert receives only approved fields and status failure preserves the saved reference", async () => {
  const alerts: object[] = []
  const results: string[] = []
  const check = createIncidentSafetyCheck(async () => crisis, {
    enabled: () => true,
    save: async () => {},
    notify: alert => { alerts.push(alert) },
    recordAlertResult: async (_reference, result) => {
      results.push(result)
      throw new Error("database offline")
    },
  })
  const verdict = await check("example", "search", "  example ")
  assert.equal(verdict.action, "safeguarding")
  assert.match(verdict.incidentReference ?? "", /^INC-/)
  assert.deepEqual(alerts, [{
    referenceId: verdict.incidentReference, surface: "search", crisis: "self_harm", triageLevel: "high",
  }])
  assert.deepEqual(results, ["simulated"])
})

test("moderation-only safeguarding is closed without an alert", async () => {
  const states: string[][] = []
  const calls: string[] = []
  const check = createIncidentSafetyCheck(async () => ({ ...crisis, crisis: null, decidedBy: "moderation" }), {
    enabled: () => true,
    save: async record => {
      states.push([record.triageLevel, record.status, record.alertStatus])
    },
    notify: () => { calls.push("notify") },
    recordAlertResult: async () => { calls.push("update") },
  })
  assert.match((await check("example", "suggestion", "example")).incidentReference ?? "", /^INC-/)
  assert.deepEqual(states, [["moderation_only", "closed", "not_required"]])
  assert.deepEqual(calls, [])
})

test("search and suggestion persist incidents and keep support on alert failure", async () => {
  Object.assign(process.env, demoEnv, {
    PGLITE_DATA_DIR: "memory://", SKIP_SEED: "true", MOCK_MODERATION_LATENCY_MS: "0",
    MOCK_MODERATION_FAILURE_RATE: "0", SAFETY_DEMO_ALERT_FAILURE: "false",
  })
  const db = await getDb()
  const rawSearch = "  I want to kill myself.  "
  const rawTerm = "  classroom slang "
  const rawContext = "\r\nI want to kill my classmate.  "
  const search = await searchTerm(rawSearch)
  assert.equal(search.kind, "safeguarding")
  assert.ok(search.kind === "safeguarding" && search.verdict.incidentReference)

  process.env.SAFETY_DEMO_ALERT_FAILURE = "true"
  const suggestion = await suggestTerm(rawTerm, rawContext)
  assert.equal(suggestion.success, false)
  assert.equal(suggestion.data?.crisis, "harm_to_others")
  assert.ok(suggestion.data?.incidentReference)

  const failedSearch = await searchTerm(rawSearch)
  assert.equal(failedSearch.kind, "safeguarding")
  assert.ok(failedSearch.kind === "safeguarding" && failedSearch.verdict.incidentReference)
  const failedSearchReference = failedSearch.verdict.incidentReference
  const rows = await db.select().from(schema.safetyIncidents)
  assert.equal(rows.length, 3)
  const searchRecord = rows.find(row => row.referenceId === search.verdict.incidentReference)
  assert.equal(searchRecord?.query, rawSearch)
  assert.equal(searchRecord?.alertStatus, "simulated")
  const suggestionRecord = rows.find(row => row.referenceId === suggestion.data?.incidentReference)
  assert.equal(suggestionRecord?.query, `${rawTerm}\n${rawContext}`)
  assert.equal(suggestionRecord?.surface, "suggestion")
  assert.equal(suggestionRecord?.alertStatus, "failed")
  assert.equal(rows.find(row => row.referenceId === failedSearchReference)?.alertStatus, "failed")
  assert.equal((await db.select().from(schema.termFeedback)).length, 0)

  const list = await readRecentSafetyIncidents()
  assert.equal(list.length, 3)
  assert.ok(list.every(item => !Object.hasOwn(item, "query")))
  const details = await readRecentSafetyIncidentDetails()
  assert.equal(details.find(item => item.referenceId === search.verdict.incidentReference)?.query, rawSearch)
  assert.equal(details.find(item => item.referenceId === suggestion.data?.incidentReference)?.query, `${rawTerm}\n${rawContext}`)
  const events = await db.select().from(schema.safetyEvents).where(eq(schema.safetyEvents.outcome, "safeguarding"))
  assert.equal(events.length, 3)
  assert.ok(events.every(event => !Object.hasOwn(event, "query") && !Object.hasOwn(event, "referenceId")))

  await searchTerm("build a bomb")
  await searchTerm("I feel hopeless")
  assert.equal((await readRecentSafetyIncidents()).length, 3)
})


test("rule-detected crises record without an incident flag in mock and live AI modes", async () => {
  const keys = ["SAFETY_INCIDENT_DEMO", "MOCK_LLM", "DATABASE_URL", "SAFETY_DEMO_ALERT_FAILURE"] as const
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  const fetch = globalThis.fetch
  let externalCalls = 0
  globalThis.fetch = async () => {
    externalCalls++
    throw new Error("This rule-detected crisis must not call an external service.")
  }
  try {
    const before = await readRecentSafetyIncidentDetails()
    for (const mock of ["true", "false"]) {
      Object.assign(process.env, demoEnv, { MOCK_LLM: mock, SAFETY_DEMO_ALERT_FAILURE: "false" })
      delete process.env.SAFETY_INCIDENT_DEMO
      const search = await searchTerm("I want to kill myself. Email demo@example.test.")
      assert.equal(search.kind, "safeguarding")
      assert.ok(search.kind === "safeguarding" && search.verdict.incidentReference)
      assert.equal(search.verdict.decidedBy, "rules")

      const suggestion = await suggestTerm("classroom slang", "I want to kill my classmate. Email demo@example.test.")
      assert.equal(suggestion.success, false)
      assert.ok(suggestion.data?.incidentReference)

      const rows = await readRecentSafetyIncidentDetails()
      for (const [reference, surface, crisis] of [
        [search.verdict.incidentReference, "search", "self_harm"],
        [suggestion.data.incidentReference, "suggestion", "harm_to_others"],
      ] as const) {
        const record = rows.find(row => row.referenceId === reference)
        assert.ok(record)
        assert.equal(record.surface, surface)
        assert.equal(record.crisis, crisis)
        assert.equal(record.alertStatus, "simulated")
        assert.match(record.query, /\[REDACTED_EMAIL\]/)
        assert.ok(!record.query.includes("demo@example.test"))
        assert.ok(Number.isFinite(record.recordedAtUtc.getTime()))
        assert.match(record.recordedAtSydney, /T/)
      }
    }
    assert.equal((await readRecentSafetyIncidentDetails()).length, before.length + 4)
    assert.equal(externalCalls, 0)
  } finally {
    globalThis.fetch = fetch
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
})
