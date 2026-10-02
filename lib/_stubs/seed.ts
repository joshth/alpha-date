import { count } from "drizzle-orm"
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core"
import { slangDatabase } from "@/lib/lexicon-data"
import * as schema from "./schema"
import {
  HISTORY_DAYS,
  SYNTHETIC_PENDING_TERMS,
  SYNTHETIC_SHAPES,
  SYNTHETIC_SUGGESTIONS,
  expectedDailyVolume,
} from "./fixtures/synthetic"

// Seeds an empty database with synthetic data: the public seed lexicon as
// published terms, ~6 months of anonymous search events per term, missing-term
// suggestions full of near-duplicates, and a few AI terms awaiting review.
// Deterministic (fixed PRNG seed) so every team member sees the same data.

type Db = PgDatabase<PgQueryResultHKT, typeof schema>

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Knuth's Poisson sampler — fine for the small means used here.
function poisson(mean: number, rand: () => number): number {
  const limit = Math.exp(-mean)
  let k = 0
  let p = 1
  do {
    k++
    p *= rand()
  } while (p > limit)
  return k - 1
}

export async function seedIfEmpty(db: Db, now = new Date()): Promise<void> {
  const [{ value }] = await db.select({ value: count() }).from(schema.terms)
  if (value > 0) return

  await db.insert(schema.terms).values(
    slangDatabase.map((t) => ({
      term: t.term,
      termLower: t.term.toLowerCase(),
      pronunciation: t.pronunciation ?? null,
      definition: t.definition,
      examples: t.examples,
      originAndContext: t.originAndContext,
      commonSentiment: t.commonSentiment,
      sensitivityRating: t.sensitivityRating,
      cautionaryNotes: t.cautionaryNotes ?? null,
      tags: t.tags ?? [],
      source: "seed",
      status: "published",
    })),
  )

  await db.insert(schema.terms).values(
    SYNTHETIC_PENDING_TERMS.map((t) => ({
      term: t.term,
      termLower: t.term.toLowerCase(),
      definition: t.definition,
      sensitivityRating: t.sensitivityRating,
      tags: ["auto-discovered", "unverified"],
      source: "llm",
      status: "pending_review",
    })),
  )

  const rand = mulberry32(20261003)
  const dayMs = 24 * 60 * 60 * 1000
  const start = now.getTime() - HISTORY_DAYS * dayMs
  const events: { termLower: string; eventType: string; createdAt: Date }[] = []
  for (const t of slangDatabase) {
    const termLower = t.term.toLowerCase()
    const shape = SYNTHETIC_SHAPES[termLower] ?? "steady"
    const base = 2 + rand() * 4
    for (let d = 0; d < HISTORY_DAYS; d++) {
      const n = poisson(expectedDailyVolume(shape, d, base), rand)
      for (let i = 0; i < n; i++) {
        events.push({
          termLower,
          eventType: rand() < 0.85 ? "search_hit" : "view",
          createdAt: new Date(start + d * dayMs + Math.floor(rand() * dayMs)),
        })
      }
    }
  }
  for (let i = 0; i < events.length; i += 1000) {
    await db.insert(schema.termEvents).values(events.slice(i, i + 1000))
  }

  await db.insert(schema.termFeedback).values(
    SYNTHETIC_SUGGESTIONS.map((s) => ({
      suggestedTerm: s.suggestedTerm,
      context: s.context ?? null,
      count: s.count,
      status: "pending",
    })),
  )
}
