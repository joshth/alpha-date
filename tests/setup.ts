// Imported first by every test file: forces a throwaway in-memory database and
// instant, deterministic mocks so tests never touch ./.data or a real provider.
process.env.PGLITE_DATA_DIR = "memory://"
process.env.MOCK_LLM = "true"
process.env.MOCK_LLM_LATENCY_MS = "0"
process.env.MOCK_LLM_FAILURE_RATE = "0"
process.env.MOCK_MODERATION_LATENCY_MS = "0"
process.env.MOCK_MODERATION_FAILURE_RATE = "0"
delete process.env.DATABASE_URL
