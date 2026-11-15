ALTER TABLE "terms" ADD COLUMN IF NOT EXISTS "term_key" text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE "terms" ALTER COLUMN "term_key" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "terms" ADD COLUMN IF NOT EXISTS "key_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "terms_term_key_idx" ON "terms" USING btree ("term_key");
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "safety_events" (
    "outcome" text NOT NULL,
    "categories" jsonb NOT NULL,
    "recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "safety_events_recorded_at_idx" ON "safety_events" USING btree ("recorded_at");
