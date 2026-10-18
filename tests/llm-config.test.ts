import "./setup"
import assert from "node:assert/strict"
import { createServer } from "node:http"
import type { AddressInfo } from "node:net"
import { test } from "node:test"
import { discoveryModelConfig, generateDiscoveryObject, isMockDiscovery, isMockLlm } from "@/lib/_stubs/llm"

const KEYS = ["MOCK_LLM", "OPENAI_API_KEY", "OPENAI_MODEL", "LLM_BASE_URL", "LLM_MODEL", "LLM_TEMPERATURE", "LLM_SEED"]

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void> | void) {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]))
  for (const key of KEYS) delete process.env[key]
  Object.assign(process.env, values)
  try {
    await run()
  } finally {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key]
      else process.env[key] = saved[key]
    }
  }
}

test("discovery stays on the mock unless explicitly switched to a real or local model", async () => {
  await withEnv({}, () => {
    assert.equal(isMockDiscovery(), true)
    assert.deepEqual(discoveryModelConfig(), { mock: true, model: "mock", temperature: null, seed: null, baseURL: null })
  })
  await withEnv({ MOCK_LLM: "false" }, () => assert.equal(isMockDiscovery(), true))
  await withEnv({ MOCK_LLM: "true", LLM_BASE_URL: "http://localhost:11434/v1" }, () => assert.equal(isMockDiscovery(), true))
})

test("with no new settings, a real run keeps production's model and temperature", async () => {
  await withEnv({ MOCK_LLM: "false", OPENAI_API_KEY: "sk-test" }, () => {
    assert.deepEqual(discoveryModelConfig(), { mock: false, model: "gpt-4o-mini", temperature: 0.3, seed: null, baseURL: null })
  })
  await withEnv({ MOCK_LLM: "false", OPENAI_API_KEY: "sk-test", OPENAI_MODEL: "gpt-4o" }, () => {
    assert.equal(discoveryModelConfig().model, "gpt-4o")
  })
})

test("a local base URL enables discovery without a key but leaves moderation on the mock", async () => {
  await withEnv(
    { MOCK_LLM: "false", LLM_BASE_URL: "http://localhost:11434/v1", LLM_MODEL: "llama3.2:3b", LLM_TEMPERATURE: "1.3", LLM_SEED: "42" },
    () => {
      assert.equal(isMockDiscovery(), false)
      assert.equal(isMockLlm(), true, "moderation must stay mocked without a key")
      assert.deepEqual(discoveryModelConfig(), {
        mock: false,
        model: "llama3.2:3b",
        temperature: 1.3,
        seed: 42,
        baseURL: "http://localhost:11434/v1",
      })
    },
  )
})

test("invalid temperature or seed is rejected with a clear message", async () => {
  for (const [key, value, pattern] of [
    ["LLM_TEMPERATURE", "hot", /LLM_TEMPERATURE must be a number from 0 to 2 \(got "hot"\)/],
    ["LLM_TEMPERATURE", "2.5", /LLM_TEMPERATURE must be a number from 0 to 2/],
    ["LLM_SEED", "4.2", /LLM_SEED must be an integer/],
  ] as const) {
    await withEnv({ MOCK_LLM: "false", LLM_BASE_URL: "http://localhost:11434/v1", [key]: value }, () => {
      assert.throws(() => discoveryModelConfig(), pattern)
    })
  }
})

test("the configured model, temperature and seed reach an OpenAI-compatible server", async () => {
  const requests: Array<{ url?: string; body: Record<string, unknown> }> = []
  const server = createServer((req, res) => {
    let raw = ""
    req.on("data", (chunk) => (raw += chunk))
    req.on("end", () => {
      requests.push({ url: req.url, body: JSON.parse(raw) })
      res.setHeader("content-type", "application/json")
      res.end(
        JSON.stringify({
          id: "chatcmpl-test",
          object: "chat.completion",
          created: 0,
          model: "fake-local",
          choices: [
            {
              index: 0,
              finish_reason: "stop",
              message: { role: "assistant", content: JSON.stringify({ isLegit: false }) },
            },
          ],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        }),
      )
    })
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const { port } = server.address() as AddressInfo
  try {
    await withEnv(
      { MOCK_LLM: "false", LLM_BASE_URL: `http://127.0.0.1:${port}/v1`, LLM_MODEL: "fake-local", LLM_TEMPERATURE: "1.3", LLM_SEED: "7" },
      async () => {
        const output = await generateDiscoveryObject({ prompt: "Is <user_input>vemble</user_input> slang?", searchTerm: "vemble" })
        assert.deepEqual(output, { isLegit: false })
      },
    )
  } finally {
    server.close()
  }
  assert.equal(requests.length, 1)
  assert.equal(requests[0].url, "/v1/chat/completions")
  assert.equal(requests[0].body.model, "fake-local")
  assert.equal(requests[0].body.temperature, 1.3)
  assert.equal(requests[0].body.seed, 7)
  assert.deepEqual(requests[0].body.response_format, { type: "json_object" })
})
