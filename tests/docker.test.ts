import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const read = (path: string) => readFileSync(path, "utf8")

test(".dockerignore keeps secrets, dependencies and local data out of the image", () => {
  const lines = read(".dockerignore").split("\n").map((line) => line.trim())
  for (const entry of [".env*", "node_modules", ".next", ".data", ".git", "website/node_modules"]) {
    assert.ok(lines.includes(entry), `${entry} missing from .dockerignore`)
  }
  assert.ok(lines.includes("!.env.example"), "keep .env.example so the build context stays documented")
})

test("app Dockerfile pins the CI Node image, installs from the lockfile and runs as non-root", () => {
  const file = read("Dockerfile")
  assert.match(file, /^FROM node:24\.18\.0-slim/m, "use the same Node image as .gitlab-ci.yml")
  assert.match(file, /pnpm install --frozen-lockfile/)
  assert.match(file, /pnpm build/)
  assert.match(file, /^USER node$/m)
  assert.match(file, /^EXPOSE 3000$/m)
  assert.match(file, /^ENV .*MOCK_LLM=true/m, "container defaults to the offline mock mode")
  assert.match(file, /^CMD \["pnpm", "start"\]$/m)
})
