CREATE TABLE "term_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "term_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"term_lower" text NOT NULL,
	"event_type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "term_feedback" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"suggested_term" text NOT NULL,
	"context" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"admin_notes" text,
	"moderation" jsonb,
	"user_ip" text,
	"count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "terms" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"term_lower" text NOT NULL,
	"pronunciation" text,
	"definition" text NOT NULL,
	"examples" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origin_and_context" text,
	"common_sentiment" text,
	"sensitivity_rating" text DEFAULT 'Use With Caution' NOT NULL,
	"cautionary_notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"detailed_origin_etymology" text,
	"cultural_impact_analysis" text,
	"communication_tips" text,
	"educator_discussion_points" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text DEFAULT 'llm' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"moderation" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "term_events_term_lower_idx" ON "term_events" USING btree ("term_lower");--> statement-breakpoint
CREATE INDEX "term_events_created_at_idx" ON "term_events" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "term_feedback_term_idx" ON "term_feedback" USING btree ("suggested_term");--> statement-breakpoint
CREATE INDEX "term_feedback_status_idx" ON "term_feedback" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "terms_term_lower_idx" ON "terms" USING btree ("term_lower");