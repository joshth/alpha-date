import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const scripts: Record<string, string> = JSON.parse(readFileSync("package.json", "utf8")).scripts
const pipeline = existsSync(".gitlab-ci.yml") ? readFileSync(".gitlab-ci.yml", "utf8") : ""

test("the GitLab pipeline forces the mock LLM and runs lint and typecheck", () => {
  // Scope rule: CI never calls a real provider, even if a key is added later.
  assert.match(pipeline, /^ {2}MOCK_LLM: "true"/m)
  assert.match(pipeline, /script: pnpm lint$/m)
  assert.match(pipeline, /script: pnpm typecheck$/m)
})

test("test:ci writes a JUnit report, with the reporter flags before the file list", () => {
  const command = scripts["test:ci"] ?? ""
  assert.match(command, /--test-reporter=junit --test-reporter-destination=junit\.xml/)
  // Node ignores reporter flags placed after the test files.
  assert.ok(command.indexOf("--test-reporter") < command.indexOf("tests/*.test.ts"))
})

test("the GitLab pipeline runs once per change and scans for secrets", () => {
  // One pipeline per change: MR pipelines when an MR is open, branch pipelines otherwise.
  assert.match(pipeline, /\$CI_PIPELINE_SOURCE == "merge_request_event"/)
  assert.match(pipeline, /\$CI_COMMIT_BRANCH && \$CI_OPEN_MERGE_REQUESTS\n\s+when: never/)
  assert.match(pipeline, /Jobs\/Secret-Detection\.gitlab-ci\.yml/)
  assert.match(pipeline, /AST_ENABLE_MR_PIPELINES: "true"/)
})
