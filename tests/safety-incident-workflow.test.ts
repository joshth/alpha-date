import assert from "node:assert/strict"
import test from "node:test"
import { eq } from "drizzle-orm"
import { searchTerm, suggestTerm } from "@/app/lab/actions"
import { getDb, schema } from "@/lib/_stubs/db"
import type { SafetyVerdict } from "@/lib/safety/gate"
import { isIncidentDemoEnabled } from "@/lib/safety/incident-demo"
import { readRecentSafetyIncidentDetails, readRecentSafetyIncidents } from "@/lib/safety/incident-store"
import { createIncidentSafetyCheck } from "@/lib/safety/incident-workflow"

const demoEnv = { SAFETY_INCIDENT_DEMO: "true", MOCK_LLM: "true", DATABASE_URL: "" }
const crisis: SafetyVerdict = {
  action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"],
  decidedBy: "rules", reason: "crisis:self_harm",
}

test("incident demo requires opt-in, mock moderation and an embedded database", () => {
  assert.equal(isIncidentDemoEnabled(demoEnv), true)
  assert.equal(isIncidentDemoEnabled({ ...demoEnv, SAFETY_INCIDENT_DEMO: "false" }), false)
  assert.equal(isIncidentDemoEnabled({ ...demoEnv, MOCK_LLM: "false" }), false)
  assert.equal(isIncidentDemoEnabled({ ...demoEnv, DATABASE_URL: "postgresql://example.test/db" }), false)
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
  process.env.SAFETY_INCIDENT_DEMO = "false"
  const off = await searchTerm(rawSearch)
  assert.ok(off.kind === "safeguarding" && !off.verdict.incidentReference)
  assert.equal((await readRecentSafetyIncidents()).length, 3)
})
