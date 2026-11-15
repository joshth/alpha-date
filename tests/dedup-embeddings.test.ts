import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { MEANING_FIXTURE, createEmbedder } from "@/lib/dedup/embeddings"
import { cosine } from "@/lib/dedup/semantic"

const F = MEANING_FIXTURE
const boom = async (): Promise<number[][]> => { throw new Error("must not be called") }

test("fixture covers exactly the seeded words, 4-d", () => {
  assert.deepEqual(Object.keys(F).sort(), ["asdfgh", "brain rot", "chopped", "gyatt", "huzz", "rizzler", "skibidy", "tuff", "zorbleflux"])
  for (const v of Object.values(F)) assert.equal(v.length, 4)
})

test("fixture cosine facts", () => {
  assert.ok(cosine(F.rizzler, F.huzz) >= 0.85)
  assert.ok(cosine(F.gyatt, F.tuff) >= 0.85)
  assert.ok(cosine(F.zorbleflux, F.asdfgh) >= 0.85)
  for (const w of ["tuff", "gyatt", "rizzler", "huzz"]) assert.ok(cosine(F.chopped, F[w]) < 0.85, w)
})

test("mock mode returns known words (lower-cased, trimmed), omits unknown, never embeds", async () => {
  const out = await createEmbedder({ mock: true, embed: boom })([" Rizzler ", "HUZZ", "nonsenseword"])
  assert.deepEqual(Object.keys(out).sort(), ["huzz", "rizzler"])
  assert.deepEqual(out.rizzler, F.rizzler)
})

test("live mode embeds unique lower-cased words once", async () => {
  const calls: string[][] = []
  const embed = async (w: string[]) => (calls.push(w), w.map((_, i) => [i, 1]))
  const out = await createEmbedder({ mock: false, embed })(["Rizz", "rizz", "Huzz"])
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0], ["rizz", "huzz"])
  assert.deepEqual(out, { rizz: [0, 1], huzz: [1, 1] })
})

test("live mode without embed throws a clear error", async () => {
  await assert.rejects(createEmbedder({ mock: false })(["x"]), /Embedding service not configured/)
})
