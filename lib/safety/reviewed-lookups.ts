import { normalizeForSafety } from "@/lib/safety/classify"

export const REVIEWED_SAFE_LOOKUPS = [
  "i'm dead",
  "im dead lol",
  "you're killing it",
  "dead ass",
  "slay",
  "i'm gonna kill it at school today",
  "shoot your shot",
  "i'm gonna shoot my shot with everyone at school",
  "my plant is going to die",
  "he's going to die of cringe",
  "i'm gonna die if he texts me",
  "cheese pizza",
  "personal grooming routine",
  "basic grooming and fitness",
  "fitspo",
] as const

const reviewed = new Set(REVIEWED_SAFE_LOOKUPS.map(normalizeForSafety))

export function isReviewedSafeLookup(text: string): boolean {
  return reviewed.has(normalizeForSafety(text))
}
