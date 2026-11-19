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
