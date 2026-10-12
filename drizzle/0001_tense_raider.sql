ALTER TABLE "terms" ADD COLUMN "term_key" text NOT NULL;--> statement-breakpoint
CREATE INDEX "terms_term_key_idx" ON "terms" USING btree ("term_key");