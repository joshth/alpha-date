import "server-only"
import { desc, eq, sql } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { termFeedback } from "@/lib/_stubs/schema"

// Missing-term suggestions (adapted from production submitTermFeedback).
//
// BASELINE dedup is production's current behaviour: exact match on the
// lower-cased, trimmed text. So "brainrot", "brain rot" and "brain-rot" are
// three separate rows — that is the problem your normalisation work fixes
// (see lib/normalise/index.ts). No IP address or account is stored.

export interface FeedbackRow {
  id: string
  suggestedTerm: string
  context: string | null
  status: string
  count: number
  createdAt: string
}

export async function recordSuggestion(suggestedTerm: string, context: string | null): Promise<{ merged: boolean }> {
  const db = await getDb()
  const key = suggestedTerm.trim().toLowerCase()
  const rows = await db
    .insert(termFeedback)
    .values({ suggestedTerm: key, context, status: "pending" })
    .onConflictDoUpdate({
      target: termFeedback.suggestedTerm,
      set: { count: sql`${termFeedback.count} + 1`, updatedAt: new Date() },
    })
    .returning({ count: termFeedback.count })
  return { merged: (rows[0]?.count ?? 1) > 1 }
}

export async function listSuggestions(status = "pending"): Promise<FeedbackRow[]> {
  const db = await getDb()
  const rows = await db
    .select()
    .from(termFeedback)
    .where(eq(termFeedback.status, status))
    .orderBy(desc(termFeedback.count), desc(termFeedback.createdAt))
  return rows.map((r) => ({
    id: r.id,
    suggestedTerm: r.suggestedTerm,
    context: r.context,
    status: r.status,
    count: r.count,
    createdAt: r.createdAt.toISOString(),
  }))
}
