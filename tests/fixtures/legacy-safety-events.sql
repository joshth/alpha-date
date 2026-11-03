CREATE TABLE "safety_events" (
	"outcome" text NOT NULL,
	"categories" jsonb NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "safety_events_recorded_at_idx" ON "safety_events" USING btree ("recorded_at");