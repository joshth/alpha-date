import { defineConfig } from "drizzle-kit"

// `pnpm db:generate` writes SQL migrations to ./drizzle from the stub schema.
// Local PGlite applies them automatically on first use (lib/_stubs/db.ts).
// `pnpm db:migrate` is only needed when DATABASE_URL points at your own
// hosted Postgres (e.g. a Neon free-tier project) — never a production DB.
export default defineConfig({
  schema: "./lib/_stubs/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://unused-for-generate",
  },
})
