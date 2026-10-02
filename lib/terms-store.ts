import "server-only"
import { and, desc, eq } from "drizzle-orm"
import type { SlangTerm } from "@/app/types"
import { getDb } from "@/lib/_stubs/db"
import { termEvents, terms } from "@/lib/_stubs/schema"

// Lexicon persistence (adapted from production lib/term-cache.ts).
// Lifecycle: published (servable to everyone) | pending_review (needs a human)
// | rejected (never served, never regenerated-and-served).

export type TermStatus = "published" | "pending_review" | "rejected"
export type TermEventType = "search_hit" | "search_miss" | "llm_generated" | "view" | "prompt_generated"

type Row = typeof terms.$inferSelect

export interface TermRecord {
  id: string
  term: SlangTerm
  status: TermStatus
  source: string
  createdAt: string
}

function toRecord(row: Row): TermRecord {
  return {
    id: row.id,
    status: row.status as TermStatus,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    term: {
      id: row.id,
      term: row.term,
      pronunciation: row.pronunciation ?? undefined,
      definition: row.definition,
      examples: row.examples ?? [],
      originAndContext: row.originAndContext ?? "",
      commonSentiment: row.commonSentiment ?? "Neutral",
      sensitivityRating: (row.sensitivityRating as SlangTerm["sensitivityRating"]) ?? "Use With Caution",
      cautionaryNotes: row.cautionaryNotes,
      tags: row.tags ?? [],
    },
  }
}

export async function getTermRecord(termText: string): Promise<TermRecord | null> {
  const db = await getDb()
  const rows = await db.select().from(terms).where(eq(terms.termLower, termText.trim().toLowerCase())).limit(1)
  return rows[0] ? toRecord(rows[0]) : null
}

export async function listPublishedTermNames(): Promise<string[]> {
  const db = await getDb()
  const rows = await db.select({ term: terms.term }).from(terms).where(eq(terms.status, "published"))
  return rows.map((r) => r.term)
}

/** Saves an AI-discovered term for human review. Never overwrites an existing row. */
export async function saveDiscoveredTerm(term: SlangTerm): Promise<TermRecord | null> {
  const db = await getDb()
  const rows = await db
    .insert(terms)
    .values({
      term: term.term,
      termLower: term.term.toLowerCase(),
      definition: term.definition,
      examples: term.examples,
      originAndContext: term.originAndContext,
      commonSentiment: term.commonSentiment,
      sensitivityRating: term.sensitivityRating,
      cautionaryNotes: term.cautionaryNotes ?? null,
      tags: term.tags ?? [],
      detailedOriginEtymology: term.detailedOriginEtymology ?? null,
      source: "llm",
      status: "pending_review",
    })
    .onConflictDoNothing()
    .returning()
  return rows[0] ? toRecord(rows[0]) : null
}

export async function listTermsByStatus(status: TermStatus, limit = 100): Promise<TermRecord[]> {
  const db = await getDb()
  const rows = await db.select().from(terms).where(eq(terms.status, status)).orderBy(desc(terms.createdAt)).limit(limit)
  return rows.map(toRecord)
}

export async function setTermStatus(id: string, status: "published" | "rejected"): Promise<boolean> {
  const db = await getDb()
  const rows = await db
    .update(terms)
    .set({ status, updatedAt: new Date() })
    .where(and(eq(terms.id, id), eq(terms.status, "pending_review")))
    .returning({ id: terms.id })
  return rows.length > 0
}

/** Anonymous usage event: term + type + time only. Never add identity fields. */
export async function logTermEvent(termText: string, eventType: TermEventType): Promise<void> {
  const db = await getDb()
  await db.insert(termEvents).values({ termLower: termText.trim().toLowerCase().slice(0, 120), eventType })
}

export async function getTermEvents(termText: string): Promise<{ eventType: string; createdAt: Date }[]> {
  const db = await getDb()
  return db
    .select({ eventType: termEvents.eventType, createdAt: termEvents.createdAt })
    .from(termEvents)
    .where(eq(termEvents.termLower, termText.trim().toLowerCase()))
}
