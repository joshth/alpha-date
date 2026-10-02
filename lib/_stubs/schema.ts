import { sql } from "drizzle-orm"
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

// STUDENT-FACING STUB SCHEMA. Only the three tables this slice touches, with
// the same column names/types as production so queries port unchanged.
// You may ADD columns/tables — record each schema change in your architecture
// write-up so it can be replayed in production.

// Verdict stored on rows by production's model-based moderation layer.
// Shape kept so review UIs port; this scaffold's mock never writes it.
export interface StoredModeration {
  provider: string
  model: string
  status: "safe" | "flagged" | "unavailable"
  hazards: string[]
  severity: "low" | "high" | "critical"
  quarantined: boolean
  latencyMs: number
  checkedAt: string
}

// Server-side lexicon (doubles as the AI cache in production).
// source: seed | llm | user_suggestion
// status: published (servable) | pending_review (needs a human) | rejected
export const terms = pgTable(
  "terms",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    term: text("term").notNull(),
    termLower: text("term_lower").notNull(),
    pronunciation: text("pronunciation"),
    definition: text("definition").notNull(),
    examples: jsonb("examples").$type<string[]>().notNull().default([]),
    originAndContext: text("origin_and_context"),
    commonSentiment: text("common_sentiment"),
    sensitivityRating: text("sensitivity_rating").notNull().default("Use With Caution"),
    cautionaryNotes: text("cautionary_notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    detailedOriginEtymology: text("detailed_origin_etymology"),
    culturalImpactAnalysis: text("cultural_impact_analysis"),
    communicationTips: text("communication_tips"),
    educatorDiscussionPoints: jsonb("educator_discussion_points")
      .$type<{ ageGroup: string; prompt: string }[]>()
      .notNull()
      .default([]),
    source: text("source").notNull().default("llm"),
    status: text("status").notNull().default("published"),
    moderation: jsonb("moderation").$type<StoredModeration>(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("terms_term_lower_idx").on(t.termLower)],
)

// Anonymous usage analytics. Deliberately has NO user linkage — never add
// user ids, IPs, session ids or device data here, not even synthetic ones.
// event_type: search_hit | search_miss | llm_generated | view | prompt_generated
export const termEvents = pgTable(
  "term_events",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    termLower: text("term_lower").notNull(),
    eventType: text("event_type").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("term_events_term_lower_idx").on(t.termLower),
    index("term_events_created_at_idx").on(t.createdAt),
  ],
)

// Missing-term suggestions from users.
// status: pending | quarantined | approved | rejected | integrated
export const termFeedback = pgTable(
  "term_feedback",
  {
    id: text("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    suggestedTerm: text("suggested_term").notNull(),
    context: text("context"),
    status: text("status").notNull().default("pending"),
    adminNotes: text("admin_notes"),
    moderation: jsonb("moderation").$type<StoredModeration>(),
    // Legacy column. Production no longer stores IP addresses with feedback
    // (data minimisation); keep it null.
    userIp: text("user_ip"),
    count: integer("count").notNull().default(1),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("term_feedback_term_idx").on(t.suggestedTerm),
    index("term_feedback_status_idx").on(t.status),
  ],
)
