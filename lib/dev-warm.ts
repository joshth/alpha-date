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
