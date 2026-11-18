import { readdirSync } from "node:fs"
import { join } from "node:path"

/** Every static page route under app/ (dynamic [segments] and route groups' API routes are skipped). */
export function warmRoutes(appDir = join(process.cwd(), "app")): string[] {
  const routes: string[] = []
  const walk = (dir: string, route: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (entry.name.startsWith("[") || entry.name === "api") continue
        walk(join(dir, entry.name), `${route}/${entry.name}`)
      } else if (entry.name === "page.tsx") {
        routes.push(route || "/")
      }
    }
  }
  walk(appDir, "")
  return routes.sort()
}

/** Requests each route in turn so the dev server compiles it before anyone clicks. Failures are logged, not thrown. */
export async function warmUp(
  origin: string,
  routes: string[],
  fetchFn: (url: string) => Promise<Response> = fetch,
): Promise<void> {
  for (const route of routes) {
    try {
      await fetchFn(`${origin}${route}`)
    } catch (err) {
      console.warn(`[warm-up] ${route} failed:`, err instanceof Error ? err.message : err)
    }
  }
}
