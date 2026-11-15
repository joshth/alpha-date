ALTER TABLE "terms" ADD COLUMN "term_key" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "terms" ALTER COLUMN "term_key" DROP DEFAULT;--> statement-breakpoint
CREATE INDEX "terms_term_key_idx" ON "terms" USING btree ("term_key");