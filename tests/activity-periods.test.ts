import "./setup"
import assert from "node:assert/strict"
import test from "node:test"
import { resolveActivityPeriod } from "@/lib/safety/activity-periods"
import { createSafetyActivityView } from "@/lib/safety/activity-view"

const now = new Date("2026-11-15T12:30:00Z")
for (const [period,date,from,to] of [
  ["day","2026-11-15","2026-11-15T00:00:00","2026-11-16T00:00:00"],
  ["week","2026-11-15","2026-11-09T00:00:00","2026-11-16T00:00:00"],
  ["week","2026-11-16","2026-11-16T00:00:00","2026-11-23T00:00:00"],
  ["week","2026-01-01","2025-12-29T00:00:00","2026-01-05T00:00:00"],
  ["month","2024-02-29","2024-02-01T00:00:00","2024-03-01T00:00:00"],
  ["month","2026-02-01","2026-02-01T00:00:00","2026-03-01T00:00:00"],
  ["month","2026-12-15","2026-12-01T00:00:00","2027-01-01T00:00:00"],
  ["year","2026-11-15","2026-01-01T00:00:00","2027-01-01T00:00:00"],
  ["year","2024-02-29","2024-01-01T00:00:00","2025-01-01T00:00:00"],
] as const) {
  test(`${period} containing ${date} uses complete UTC calendar boundaries`, () => {
    assert.deepEqual(resolveActivityPeriod(period,date,now), {from,to,preset:{period,date}})
  })
}

test("default selection is today's UTC calendar day", () => {
  assert.deepEqual(resolveActivityPeriod(undefined,undefined,now), resolveActivityPeriod("day","2026-11-15",now))
})

for (const [period,date] of [["term","2026-11-15"],["day","2026-02-30"],["month","2026-13-01"],["year","9999-01-01"],["week",["2026-11-15"]],[["day"],"2026-11-15"],["day","private text"],["day",""]] as const) {
  test(`invalid preset ${JSON.stringify([period,date])} is rejected`, async () => {
    assert.throws(()=>resolveActivityPeriod(period,date,now), /Choose a valid/)
    const view = createSafetyActivityView({getSessionUser:async()=>({id:"fixture",name:"Reviewer",email:"fixture@example.test"}),isReviewer:()=>true,readSafetyActivity:async()=>{assert.fail("No read expected")},now:()=>now})
    const result = await view({period:period as unknown as string,date:date as unknown as string})
    assert.equal(result.status,"error")
    assert.equal(JSON.stringify(result).includes("private text"),false)
  })
}

test("period resolver reaches the reader with timezone-qualified boundaries", async () => {
  const calls: unknown[]=[]
  const load = createSafetyActivityView({getSessionUser:async()=>({id:"fixture",name:"Reviewer",email:"fixture@example.test"}),isReviewer:()=>true,readSafetyActivity:async period=>{calls.push(period);throw Error("synthetic unavailable")},now:()=>now})
  const result=await load({period:"month",date:"2024-02-29"})
  assert.equal(result.status,"error")
  assert.deepEqual(calls,[{from:"2024-02-01T00:00:00Z",to:"2024-03-01T00:00:00Z"}])
  assert.equal(JSON.stringify(result).includes("synthetic unavailable"),false)
})
