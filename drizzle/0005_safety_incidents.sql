CREATE TABLE "safety_incidents" (
	"reference_id" text PRIMARY KEY NOT NULL,
	"query_text" text NOT NULL,
	"surface" text NOT NULL,
	"crisis" text,
	"categories" jsonb NOT NULL,
	"recorded_at_utc" timestamp with time zone NOT NULL,
	"recorded_at_sydney" text NOT NULL,
	"local_timezone" text NOT NULL,
	"triage_level" text NOT NULL,
	"status" text NOT NULL,
	"alert_status" text NOT NULL
);
--> statement-breakpoint
CREATE INDEX "safety_incidents_recorded_at_idx" ON "safety_incidents" USING btree ("recorded_at_utc");