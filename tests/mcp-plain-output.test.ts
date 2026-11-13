import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { scoreTermLifecycle } from "@/lib/aura"
import { slangDatabase } from "@/lib/lexicon-data"
import { createDecoderTools } from "@/lib/mcp/tools"
import { checkInputSafety } from "@/lib/safety/gate"
import { getTermByKey, getTermEvents, listPublishedTermNames } from "@/lib/terms-store"

// A11Y-15 sweep: every tool answer for every seed term must be plain, short-lined text.
const tools = createDecoderTools({
  checkInputSafety,
  getTermByKey,
  listPublishedTermNames,
  getTermEvents,
  scoreTermLifecycle,
  now: () => new Date(),
})

const rules: [string, (out: string, lines: string[]) => boolean][] = [
  ["first line over 80 chars", (_, l) => l[0].length > 80],
  ["HTML tag", (o) => /<[a-z/][^>]*>/i.test(o)],
  ["Markdown table row", (_, l) => l.some((x) => x.startsWith("|"))],
  ["Markdown bold", (o) => o.includes("**")],
  ["Markdown heading", (_, l) => l.some((x) => x.startsWith("#"))],
  ["emoji", (o) => /\p{Extended_Pictographic}/u.test(o)],
  ["line over 400 chars", (_, l) => l.some((x) => x.length > 400)],
]

for (const name of ["lookupTerm", "getAura", "getAuraTrend"] as const) {
  test(`${name} output is plain text for every seed term`, async () => {
    const failures: string[] = []
    for (const { term } of slangDatabase) {
      const out = await tools[name](term)
      const lines = out.split("\n")
      for (const [rule, broken] of rules) if (broken(out, lines)) failures.push(`${name} ${term}: ${rule}`)
    }
    assert.deepEqual(failures, [])
  })
}
