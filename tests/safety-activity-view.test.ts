import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createSafetyActivityView, type ActivityParams, type SafetyActivityView } from "@/lib/safety/activity-view"
import { createSafetyActivityReader, type SafetyActivity } from "@/lib/safety/activity"

const activity: SafetyActivity = {
  period: { from: "2026-11-01T12:00:00.000Z", to: "2026-11-02T12:00:00.000Z" },
  evaluated: 5, allowed: 2, blocked: 3, blockedRate: 0.6,
  byOutcome: { safe: 2, refuse: 1, safeguarding: 1, gentle_support: 1 },
}
const user = { id: "fixture-reviewer", name: "Synthetic reviewer", email: "reviewer@example.test" }
function dependencies(readSafetyActivity = async (_period: { from: string; to: string }) => activity) {
  return { getSessionUser: async () => user, isReviewer: () => true, readSafetyActivity, now: () => new Date("2026-11-02T12:00:00Z") }
}

test("default view requests the last 24 hours in UTC", async () => {
  const calls: unknown[] = []
  const load = createSafetyActivityView(dependencies(async period => { calls.push(period); return activity }))
  assert.deepEqual(await load({}), { status: "ready", from: "2026-11-01T12:00:00", to: "2026-11-02T12:00:00", activity })
  assert.deepEqual(calls, [{ from: "2026-11-01T12:00:00Z", to: "2026-11-02T12:00:00Z" }])
})

for (const [name, from, to, expected] of [
  ["minute", "2026-11-01T12:00", "2026-11-02T12:00", { from: "2026-11-01T12:00:00Z", to: "2026-11-02T12:00:00Z" }],
  ["second", "2026-11-01T12:00:01", "2026-11-02T12:00:02", { from: "2026-11-01T12:00:01Z", to: "2026-11-02T12:00:02Z" }],
] as const) {
  test(`submitted ${name} timestamps are interpreted as UTC and retained in the form`, async () => {
    const load = createSafetyActivityView(dependencies(async period => { assert.deepEqual(period, expected); return activity }))
    assert.deepEqual(await load({ from, to }), { status: "ready", from, to, activity })
  })
}

for (const state of ["signed out", "non-reviewer"] as const) {
  test(`${state} is denied before reading activity or generating a period`, async () => {
    const load = createSafetyActivityView({ ...dependencies(async () => { assert.fail("No read permitted") }),
      getSessionUser: async () => state === "signed out" ? null : user,
      isReviewer: () => false, now: () => { assert.fail("No period should be generated") },
    })
    assert.deepEqual(await load({}), { status: "forbidden" })
  })
}

for (const [name, params] of [
  ["partial", { from: "2026-11-01T12:00" }],
  ["duplicate", { from: ["2026-11-01T12:00", "2026-11-01T12:00"], to: "2026-11-02T12:00" }],
  ["empty", { from: "", to: "" }],
  ["malformed", { from: "private fixture", to: "2026-11-02T12:00" }],
  ["offset", { from: "2026-11-01T12:00Z", to: "2026-11-02T12:00" }],
  ["date only", { from: "2026-11-01", to: "2026-11-02" }],
] as [string, ActivityParams][]) {
  test(`${name} form input produces a recoverable error without querying`, async () => {
    const load = createSafetyActivityView(dependencies(async () => { assert.fail("No read expected") }))
    const view = await load(params)
    assert.equal(view.status, "error")
    if (view.status === "error") assert.equal(view.message, "Choose a start and end time in UTC.")
    assert.equal("activity" in view, false)
  })
}

test("database error details are hidden, filters retained and the next submission can recover", async () => {
  let calls = 0
  const load = createSafetyActivityView(dependencies(async () => {
    if (++calls === 1) throw new Error("private SQL connection details")
    return activity
  }))
  const params = { from: "2026-11-01T12:00", to: "2026-11-02T12:00" }
  const failure = await load(params)
  assert.equal(failure.status, "error")
  assert.equal("activity" in failure, false)
  assert.equal(JSON.stringify(failure).includes("private SQL"), false)
  assert.equal((await load(params)).status, "ready")
})

for (const from of ["2026-11-03T12:00", "2026-02-30T12:00"]) {
  test(`invalid selected period ${from} is rejected by the real reader before database access`, async () => {
    const read = createSafetyActivityReader(async () => { assert.fail("No database access expected") })
    const load = createSafetyActivityView(dependencies(read))
    const view = await load({ from, to: "2026-11-02T12:00" })
    assert.equal(view.status, "error")
    assert.equal("activity" in view, false)
  })
}

function render(views: SafetyActivityView[]): string[] {
  const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    globalThis.React = React;
    const { renderToStaticMarkup } = require("react-dom/server");
    const { SafetyActivitySummary } = require("./components/safety/activity-summary.tsx");
    console.log(JSON.stringify(JSON.parse(process.argv[1]).map(view => renderToStaticMarkup(React.createElement(SafetyActivitySummary, { view })))));
  `, JSON.stringify(views)], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  return JSON.parse(output)
}

test("summary rendering has labelled UTC filters, semantic counts, empty and distinct failure states", () => {
  const fields = { from: "2026-11-01T12:00", to: "2026-11-02T12:00" }
  const [ready, empty, error, forbidden] = render([
    { status: "ready", ...fields, activity },
    { status: "ready", ...fields, activity: { ...activity, evaluated: 0, allowed: 0, blocked: 0, blockedRate: null,
      byOutcome: { safe: 0, refuse: 0, safeguarding: 0, gentle_support: 0 } } },
    { status: "error", ...fields, message: "Could not load safety activity." }, { status: "forbidden" },
  ])
  assert.match(ready, /method="get"/)
  assert.match(ready, /for="activity-from"/)
  assert.match(ready, /for="activity-to"/)
  assert.match(ready, /aria-describedby="period-help"/)
  assert.match(ready, /scope="col"/)
  assert.match(ready, /scope="row"/)
  assert.match(ready, /60%/)
  assert.match(ready, /Gentle support/)
  assert.match(ready, /do not measure unique users, model calls avoided or cost savings/)
  assert.match(empty, /Not available/)
  assert.match(empty, /No recorded outcomes in this period/)
  assert.doesNotMatch(empty, /60%|>0%/)
  assert.match(error, /role="alert"/)
  assert.doesNotMatch(error, /Recorded evaluations|No recorded outcomes|<table/)
  assert.match(forbidden, /Reviewer access required/)
  assert.doesNotMatch(forbidden, /<form|<table|Recorded evaluations/)
})

test("invalid filter values are escaped in rendered markup", () => {
  const [markup] = render([{ status: "error", from: '\"><script>alert(1)</script>', to: "", message: "Choose a period." }])
  assert.doesNotMatch(markup, /<script>/)
  assert.match(markup, /&lt;script&gt;/)
})
