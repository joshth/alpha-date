"use server"

import { generateDiscoveryObject } from "@/lib/_stubs/llm"
import { loadGoldenSet } from "@/lib/eval/golden"
import { checkInputSafety } from "@/lib/safety/gate"
import { moderate } from "@/lib/_stubs/moderation"
import { createTrackedSafetyGate } from "@/lib/safety/events"
import { recordSafetyEvent } from "@/lib/safety/event-store"
import { createSafeDiscovery } from "@/lib/discovery/safe-discovery"
import { createSafeTermLookup } from "@/lib/safety/safe-term-lookup"
import { createSearchTerm } from "@/lib/search"
import { getTermByKey, logTermEvent, saveDiscoveredTerm } from "@/lib/terms-store"
import type { SearchOutcome } from "@/lib/types"

export type StageId = "safety" | "lookup" | "discovery" | "store"
export interface Stage { id: StageId; state: "pass" | "stop" | "warn" | "skip"; detail: string }

const trackedSafety = createTrackedSafetyGate(checkInputSafety, recordSafetyEvent)
const safeLookup = createSafeTermLookup(getTermByKey, moderate)
const safeDiscovery = createSafeDiscovery(generateDiscoveryObject, moderate)

// Same createSearchTerm as /lab/search; each dependency is wrapped to record what it did.
export async function traceSearch(raw: string): Promise<{ stages: Stage[]; outcome: SearchOutcome }> {
  const seen: Partial<Record<StageId, Stage>> = {}
  const run = createSearchTerm({
    logTermEvent,
    checkInputSafety: async (text, surface) => {
      const v = await trackedSafety(text, surface)
      seen.safety = {
        id: "safety", state: v.action === "safe" ? "pass" : "stop",
        detail: v.action === "safe" ? "safe" : v.action === "refuse" ? "refused" : "help links shown",
      }
      return v
    },
    getTermByKey: async (key) => {
      const t = await safeLookup(key)
      seen.lookup = {
        id: "lookup", state: "pass",
        detail: t ? (t.status === "published" ? `in the lexicon, no AI call (key ${key})` : `already ${t.status.replace("_", " ")}`) : `not found (key ${key})`,
      }
      return t
    },
    generateDiscoveryObject: async (i) => {
      const o = await safeDiscovery(i)
      seen.discovery = o.isLegit && o.definition
        ? { id: "discovery", state: "pass", detail: "AI says real slang" }
        : { id: "discovery", state: "stop", detail: "AI finds no slang" }
      return o
    },
    saveDiscoveredTerm: async (term) => {
      const r = await saveDiscoveredTerm(term)
      seen.store = { id: "store", state: "pass", detail: "saved, waiting for human review" }
      return r
    },
  })
  const outcome = await run(raw)
  // Scope 2 tie-in: compare the AI's answer with the answer key, when the word is in it.
  const asked = raw.trim().toLowerCase()
  const key = loadGoldenSet().cases.find((c) => c.kind === "discovery" && c.input.toLowerCase() === asked)
  if (key?.kind === "discovery" && seen.discovery) {
    const saidReal = seen.discovery.state === "pass"
    const real = key.discovery.isRealSlang
    seen.discovery = saidReal && !real
      ? { id: "discovery", state: "warn", detail: "AI says slang. Answer key says made up." }
      : { id: "discovery", state: saidReal ? "pass" : "stop", detail: `${seen.discovery.detail}. Matches the answer key.` }
  }
  const order: StageId[] = ["safety", "lookup", "discovery", "store"]
  const stages = order.map((id) => seen[id] ?? { id, state: "skip" as const, detail: "not reached" })
  return { stages, outcome }
}
