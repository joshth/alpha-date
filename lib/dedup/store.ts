import "server-only"
import { desc, sql } from "drizzle-orm"
import { getDb } from "@/lib/_stubs/db"
import { termFeedback } from "@/lib/_stubs/schema"
import { dedupSavings, type DedupSavings } from "./savings"

/** Suggestion text and count only, highest count first. No ids, context or IPs leave the database layer. */
export async function readDedupRows(): Promise<{ suggestedTerm: string; count: number }[]> {
  const db = await getDb()
  return db
    .select({ suggestedTerm: termFeedback.suggestedTerm, count: termFeedback.count })
    .from(termFeedback)
    .orderBy(desc(termFeedback.count), desc(termFeedback.createdAt))
}

export async function readDedupSavings(minutesPerReview = 2): Promise<DedupSavings> {
  const db = await getDb()
  const rows = await db
    .select({
      suggestedTerm: termFeedback.suggestedTerm,
      count: termFeedback.count,
      status: termFeedback.status,
      bytes: sql<number>`pg_column_size(term_feedback.*)`,
    })
    .from(termFeedback)
    .orderBy(desc(termFeedback.count), desc(termFeedback.createdAt))
  return dedupSavings(rows.map(r => ({ ...r, bytes: Number(r.bytes) })), minutesPerReview)
}
