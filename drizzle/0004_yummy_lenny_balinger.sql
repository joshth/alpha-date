CREATE TABLE "safety_examples" (
	"id" text PRIMARY KEY NOT NULL,
	"phrase" text NOT NULL,
	"expected_action" text NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"crisis" text,
	"rationale" text NOT NULL,
	"source" text DEFAULT 'synthetic-context-v1' NOT NULL
);
