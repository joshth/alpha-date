/**
 * The local PGlite folder admits one process at a time, so the MCP server must not share it with the
 * site or another client. With no DATABASE_URL (shared Postgres) it gets a private in-memory copy.
 */
export function defaultMcpDatabase(env: Record<string, string | undefined> = process.env): void {
  if (env.DATABASE_URL?.trim() || env.PGLITE_DATA_DIR) return
  env.PGLITE_DATA_DIR = "memory://"
}
