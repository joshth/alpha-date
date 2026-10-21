import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { createInputSafetyGate } from "@/lib/safety/gate"
import { createSearchTerm } from "@/lib/search"
import { createSuggestTerm } from "@/lib/suggestions"

function harness(unavailable = false) {
  const calls: string[] = []
  const screened: string[] = []
  const lookups: string[] = []
  const saved: { term: string; context: string | null }[] = []
  const gate = createInputSafetyGate(async () => {
    calls.push("moderation")
    return { status: unavailable ? "unavailable" : "safe", categories: [], provider: "test", latencyMs: 0 }
  })
  const check = async (text: string, surface: "search" | "suggestion" = "search") => {
    calls.push("gate")
    screened.push(text)
    return gate(text, surface)
  }
  const search = createSearchTerm({
    checkInputSafety: check,
    getTermRecord: async (query) => { calls.push("lookup"); lookups.push(query); return null },
    logTermEvent: async () => { calls.push("event") },
    generateDiscoveryObject: async () => { calls.push("discovery"); return { isLegit: false } },
    saveDiscoveredTerm: async () => { calls.push("save"); return null },
  })
  const suggest = createSuggestTerm({
    checkInputSafety: check,
    recordSuggestion: async (term, context) => { saved.push({ term, context }); return { merged: false } },
  })
  return { search, suggest, calls, screened, lookups, saved }
}

for (const [index, context] of [
  "x".repeat(501),
  "x".repeat(500) + " i want to kill myself",
].entries()) {
  test(`oversized context ${index + 1} is rejected before screening or saving`, async () => {
    const h = harness()
    const result = await h.suggest("rizz", context)
    assert.equal(result.success, false)
    assert.match(result.message, /500/)
    assert.deepEqual(h.calls, [])
    assert.deepEqual(h.saved, [])
  })
}

test("non-string optional context is rejected rather than discarded", async () => {
  for (const context of [null, 42, {}, ["context"]]) {
    const h = harness()
    const result = await h.suggest("rizz", context as unknown as string)
    assert.equal(result.success, false)
    assert.deepEqual(h.calls, [])
    assert.deepEqual(h.saved, [])
  }
})

for (const [index, separator] of ["\n", "\r\n", "\r", "\u2028", "\u2029"].entries()) {
  test(`line boundary ${index + 1} preserves the self-harm crisis kind through both flows`, async () => {
    const input = `i want to kill myself${separator}i'm gonna kill it at school today`
    const search = harness()
    const found = await search.search(input)
    assert.equal(found.kind, "safeguarding")
    if (found.kind === "safeguarding") assert.equal(found.verdict.crisis, "self_harm")
    assert.deepEqual(search.calls, ["gate"])

    for (const inContext of [true, false]) {
      const h = harness()
      const result = inContext ? await h.suggest("rizz", input) : await h.suggest(input)
      assert.equal(result.success, false)
      assert.equal(result.data?.crisis, "self_harm")
      assert.deepEqual(h.calls, ["gate"])
      assert.deepEqual(h.saved, [])
    }
  })
}

for (const [index, input] of [
  "ｉ ｗａｎｔ ｔｏ ｋｉｌｌ ｍｙｓｅｌｆ",
  "í wánt tó kíll mysélf",
  "😟 i want to kill myself",
].entries()) {
  test(`supported Unicode risk ${index + 1} remains safeguarded through both flows`, async () => {
    const h = harness()
    const found = await h.search(input)
    assert.equal(found.kind, "safeguarding")
    if (found.kind === "safeguarding") assert.equal(found.verdict.crisis, "self_harm")
    const submitted = await h.suggest("rizz", input)
    assert.equal(submitted.data?.crisis, "self_harm")
    assert.deepEqual(h.calls, ["gate", "gate"])
    assert.deepEqual(h.saved, [])
  })
}

test("search screens risk at the last allowed character without truncation", async () => {
  const suffix = " i want to kill myself"
  const input = "x".repeat(120 - suffix.length) + suffix
  const h = harness()
  const result = await h.search(input)
  assert.equal(result.kind, "safeguarding")
  assert.deepEqual(h.screened, [input])
  assert.deepEqual(h.calls, ["gate"])
})

test("suggestion screens risk at the context limit without truncation", async () => {
  const suffix = " i want to kill myself"
  const context = "x".repeat(500 - suffix.length) + suffix
  const h = harness()
  const result = await h.suggest("rizz", context)
  assert.equal(result.data?.crisis, "self_harm")
  assert.deepEqual(h.screened, [`rizz\n${context}`])
  assert.deepEqual(h.calls, ["gate"])
  assert.deepEqual(h.saved, [])
})

test("maximum-length benign suggestion fields are screened and saved intact", async () => {
  const h = harness()
  const term = "x".repeat(100), context = "y".repeat(500)
  assert.equal((await h.suggest(term, context)).success, true)
  assert.deepEqual(h.saved, [{ term, context }])
  assert.deepEqual(h.screened, [`${term}\n${context}`])
})

test("overlong search and suggestion terms stop before screening", async () => {
  const h = harness()
  assert.equal((await h.search("x".repeat(121))).kind, "error")
  assert.equal((await h.suggest("x".repeat(101), "ordinary")).success, false)
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.saved, [])
})

test("emoji at each UTF-16 limit is kept intact", async () => {
  const h = harness()
  const query = "😀".repeat(60)
  assert.equal((await h.search(query)).kind, "not_found")
  assert.equal((await h.suggest("😀".repeat(50), "😀".repeat(250))).success, true)
  assert.deepEqual(h.lookups, [query])
  assert.deepEqual(h.saved, [{ term: "😀".repeat(50), context: "😀".repeat(250) }])
})

test("emoji beyond each UTF-16 limit is rejected without slicing", async () => {
  const h = harness()
  assert.equal((await h.search("😀".repeat(61))).kind, "error")
  assert.equal((await h.suggest("😀".repeat(51))).success, false)
  assert.equal((await h.suggest("rizz", "😀".repeat(251))).success, false)
  assert.deepEqual(h.calls, [])
  assert.deepEqual(h.saved, [])
})

test("blank context remains optional while nonblank context is never silently lost", async () => {
  for (const context of [undefined, "", " \t\n\u00a0"]) {
    const h = harness()
    assert.equal((await h.suggest("rizz", context)).success, true)
    assert.deepEqual(h.screened, ["rizz\n"])
    assert.deepEqual(h.saved, [{ term: "rizz", context: null }])
  }
})

test("large whitespace groups produce a bounded safety payload and canonical lookup", async () => {
  const h = harness()
  const input = "rizz" + " \r\n\t".repeat(10000) + "ordinary"
  assert.equal((await h.search(input)).kind, "not_found")
  assert.deepEqual(h.screened, ["rizz\nordinary"])
  assert.deepEqual(h.lookups, ["rizz ordinary"])
})

test("screening retains line breaks while stored suggestion text stays canonical", async () => {
  const h = harness()
  assert.equal((await h.suggest("  rizz  ", "ordinary\r\ncontext")).success, true)
  assert.deepEqual(h.screened, ["rizz\nordinary\ncontext"])
  assert.deepEqual(h.saved, [{ term: "rizz", context: "ordinary context" }])
})

test("provider outages still stop newline input before lookup or writes", async () => {
  const h = harness(true)
  assert.equal((await h.search("rizz\nordinary")).kind, "refused")
  const result = await h.suggest("rizz", "ordinary\ncontext")
  assert.equal(result.success, false)
  assert.equal(result.data?.decidedBy, "fail_closed")
  assert.deepEqual(h.calls, ["gate", "moderation", "gate", "moderation"])
  assert.deepEqual(h.saved, [])
})
