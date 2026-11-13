import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

// Lab components use theme tokens only (DASH-01): no raw hex colours in app/lab or components/lab.
const files = (dir: string): string[] =>
  !existsSync(dir)
    ? []
    : readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory() ? files(join(dir, e.name)) : /\.(tsx?|css)$/.test(e.name) ? [join(dir, e.name)] : [],
      )

test("Lab pages and components use theme tokens, never raw hex colours", () => {
  const hits = ["app/lab", "components/lab", "components/aura"].flatMap(files).flatMap((f) =>
    readFileSync(f, "utf8").split("\n").flatMap((line, i) => (/#[0-9a-fA-F]{3,8}\b/.test(line) ? [`${f}:${i + 1}: ${line.trim()}`] : [])),
  )
  assert.deepEqual(hits, [])
})
