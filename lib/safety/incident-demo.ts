import "server-only"

export function isIncidentDemoEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.SAFETY_INCIDENT_DEMO === "true" && env.MOCK_LLM === "true" && !env.DATABASE_URL?.trim()
}
