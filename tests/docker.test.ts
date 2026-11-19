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

test("docs Dockerfile builds the Docusaurus site with its content folders and serves it as non-root", () => {
  const file = read("website/Dockerfile")
  assert.match(file, /^FROM node:24\.18\.0-slim AS build/m)
  assert.match(file, /pnpm install --frozen-lockfile --ignore-workspace/)
  assert.match(file, /COPY .*docs.* \.\.?\/?docs|COPY docs \.\.\/docs|COPY .*\/docs/, "the site reads ../docs")
  assert.match(file, /openapi/, "the site serves ../openapi as static files")
  assert.match(file, /pnpm build/)
  assert.match(file, /^FROM nginxinc\/nginx-unprivileged:[\w.-]+/m)
  assert.match(file, /COPY --from=build .*\/build /)
  assert.match(file, /^EXPOSE 8080$/m)
})

test("compose.yaml starts the app on 3000 and the docs on 3001 with the offline defaults", () => {
  const file = read("compose.yaml")
  assert.match(file, /^  app:$/m)
  assert.match(file, /^  docs:$/m)
  assert.match(file, /"3000:3000"/)
  assert.match(file, /"3001:8080"/)
  assert.match(file, /dockerfile: website\/Dockerfile/)
  assert.match(file, /MOCK_LLM: "true"/)
  assert.match(file, /\.\/\.data|app-data:\/app\/\.data/, "keep the PGlite database between runs")
  assert.doesNotMatch(file, /OPENAI_API_KEY\s*:\s*\S*sk-/, "no real keys in compose")
})
