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

test("app image creates /app/.data as the node user so the data volume is writable", () => {
  assert.match(read("Dockerfile"), /^RUN mkdir \.data$/m)
})

test("README documents how to build and run the containers (course report requirement)", () => {
  const readme = read("README.md")
  assert.match(readme, /^## Docker$/m)
  assert.match(readme, /docker compose up --build/)
  assert.match(readme, /http:\/\/localhost:3000/)
  assert.match(readme, /http:\/\/localhost:3001/)
  assert.match(readme, /docker build -t alpha-date \./)
  assert.match(readme, /docker compose down -v/)
})

test("docs Dockerfile pins the same pnpm as the root package.json", () => {
  const pinned = /"packageManager": "(pnpm@[\d.]+)"/.exec(read("package.json"))?.[1]
  assert.ok(pinned, "root package.json should pin pnpm")
  assert.ok(read("website/Dockerfile").includes(`corepack prepare ${pinned} --activate`))
})

test("app image builds the SIRS Python environment (uv + pnpm sirs:setup) as the node user", () => {
  const file = read("Dockerfile")
  const copy = file.indexOf("COPY --chown=node:node . .")
  const setup = file.indexOf("RUN pnpm sirs:setup")
  assert.match(file, /^COPY --from=ghcr\.io\/astral-sh\/uv:[\w.]+ \/uv \/usr\/local\/bin\/uv$/m, "uv downloads Python 3.12, which bookworm lacks")
  assert.ok(setup > copy && copy > -1, "run sirs:setup after the sources (and sirs/) are copied")
  assert.ok(file.indexOf("USER node") < setup, "venv must belong to the node user")
})
