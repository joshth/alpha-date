import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createSafetyIncident, type IncidentInput } from "@/lib/safety/incidents"
import type { SafetyVerdict } from "@/lib/safety/gate"

const reference = "INC-12345678-1234-4234-8234-123456789abc"
const now = new Date("2026-11-02T01:02:03.456Z")
const verdict: SafetyVerdict = { action: "safeguarding", crisis: "self_harm", categories: ["suicide_self_harm"], decidedBy: "rules", reason: "crisis:self_harm" }
const input: IncidentInput = { query: "Synthetic crisis fixture", surface: "search", verdict, triageLevel: "high" }

for (const crisis of ["self_harm", "harm_to_others"] as const) {
  for (const triageLevel of ["high", "medium"] as const) {
    test(`${crisis} with supplied ${triageLevel} triage stays open with a pending alert`, () => {
      const record = createSafetyIncident({ ...input, triageLevel, verdict: { ...verdict, crisis } }, now, reference)
      assert.equal(record.referenceId, reference)
      assert.equal(record.crisis, crisis)
      assert.equal(record.triageLevel, triageLevel)
      assert.equal(record.status, "open")
      assert.equal(record.alertStatus, "pending")
    })
  }
}

for (const surface of ["search", "suggestion"] as const) {
  test(`${surface} preserves the exact query including Unicode, line endings and whitespace`, () => {
    const query = "  Synthetic 😟 fixture\r\nDo not normalise this text.  "
    const record = createSafetyIncident({ ...input, query, surface }, now, reference)
    assert.equal(record.query, query)
    assert.equal(record.surface, surface)
  })
}

for (const [utc, sydney] of [
  ["2026-11-02T01:02:03.456Z", "2026-11-02T12:02:03.456+11:00"],
  ["2026-06-01T20:00:00.012Z", "2026-06-02T06:00:00.012+10:00"],
  ["2026-10-03T15:59:59.999Z", "2026-10-04T01:59:59.999+10:00"],
  ["2026-10-03T16:00:00.000Z", "2026-10-04T03:00:00.000+11:00"],
  ["2026-04-04T15:59:59.999Z", "2026-04-05T02:59:59.999+11:00"],
  ["2026-04-04T16:00:00.000Z", "2026-04-05T02:00:00.000+10:00"],
]) {
  test(`Sydney timestamp represents the same instant at ${utc}`, () => {
    const record = createSafetyIncident(input, new Date(utc), reference)
    assert.equal(record.recordedAtUtc, utc)
    assert.equal(record.recordedAtSydney, sydney)
    assert.equal(Date.parse(record.recordedAtSydney), Date.parse(record.recordedAtUtc))
    assert.equal(record.localTimezone, "Australia/Sydney")
  })
}

test("supplied moderation-only triage closes without requiring an alert", () => {
  const record = createSafetyIncident({ ...input, triageLevel: "moderation_only", verdict: {
    ...verdict, crisis: null, decidedBy: "moderation", categories: ["sexual_exploitation"], reason: "moderation_safeguarding",
  } }, now, reference)
  assert.equal(record.crisis, null)
  assert.equal(record.status, "closed")
  assert.equal(record.alertStatus, "not_required")
})

for (const crisis of ["self_harm", "harm_to_others"] as const) {
  test(`explicit ${crisis} cannot be closed by labelling it moderation-only`, () => {
    assert.throws(() => createSafetyIncident({ ...input, triageLevel: "moderation_only", verdict: { ...verdict, crisis } }),
      /cannot be closed as moderation-only/)
  })
}

test("a rule-based verdict cannot be labelled moderation-only", () => {
  assert.throws(() => createSafetyIncident({ ...input, triageLevel: "moderation_only", verdict: { ...verdict, crisis: null } }),
    /cannot be closed as moderation-only/)
})

for (const action of ["safe", "refuse"] as const) {
  test(`${action} verdicts do not create incident records`, () => {
    assert.throws(() => createSafetyIncident({ ...input, verdict: { ...verdict, action } }), { message: "Could not create a safety incident." })
  })
}

test("the record has only approved incident fields and rejects identity or telemetry fields", () => {
  const record = createSafetyIncident(input, now, reference)
  assert.deepEqual(Object.keys(record).sort(), [
    "referenceId", "query", "surface", "crisis", "categories", "recordedAtUtc", "recordedAtSydney", "localTimezone", "triageLevel", "status", "alertStatus",
  ].sort())
  for (const key of ["userId", "ip", "userIp", "sessionId", "deviceId", "deviceTelemetry"]) {
    assert.throws(() => createSafetyIncident({ ...input, [key]: "private-fixture" } as IncidentInput), { message: "Could not create a safety incident." })
    assert.throws(() => createSafetyIncident({ ...input, verdict: { ...verdict, [key]: "private-fixture" } } as IncidentInput), { message: "Could not create a safety incident." })
  }
})

test("category arrays are copied and deduplicated, and free-text reasons are excluded", () => {
  const source = { ...verdict, categories: ["suicide_self_harm", "suicide_self_harm"] as SafetyVerdict["categories"], reason: "private-fixture-reason" }
  const record = createSafetyIncident({ ...input, verdict: source }, now, reference)
  assert.deepEqual(record.categories, ["suicide_self_harm"])
  record.categories.push("violence_threat")
  assert.deepEqual(source.categories, ["suicide_self_harm", "suicide_self_harm"])
  assert.equal(JSON.stringify(record).includes("private-fixture-reason"), false)
})

test("default references use independent random UUIDs without query-derived identifiers", () => {
  const first = createSafetyIncident(input)
  const second = createSafetyIncident(input)
  assert.match(first.referenceId, /^INC-[0-9a-f-]{36}$/i)
  assert.notEqual(first.referenceId, second.referenceId)
  assert.equal(Date.parse(first.recordedAtUtc), Date.parse(first.recordedAtSydney))
})

test("malformed input is rejected without echoing query text or values", () => {
  for (const value of [
    { ...input, query: " \t\n" }, { ...input, query: 42 },
    { ...input, surface: "private-fixture" }, { ...input, triageLevel: "private-fixture" },
    { ...input, verdict: { ...verdict, categories: ["private-fixture"] } },
  ]) assert.throws(() => createSafetyIncident(value as IncidentInput), { message: "Could not create a safety incident." })
})

test("missing triage is rejected rather than inventing an institutional rule", () => {
  const { triageLevel: _omitted, ...withoutTriage } = input
  assert.throws(() => createSafetyIncident(withoutTriage as IncidentInput), { message: "Could not create a safety incident." })
})

test("invalid clock or reference metadata is rejected", () => {
  assert.throws(() => createSafetyIncident(input, new Date(NaN), reference), { message: "Could not create a safety incident." })
  assert.throws(() => createSafetyIncident(input, now, "user-derived-id"), { message: "Could not create a safety incident." })
})
