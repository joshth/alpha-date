import { normalizeForSafety } from "@/lib/safety/classify"
import type { SafetyVerdict } from "@/lib/safety/gate"

// Additional, deliberately bounded rules. A slang word alone is not distress.
// Match first-person statements or explicit harmful requests, not substrings in
// educational questions, reported speech, quotations or negated statements.
const GENTLE = [
  /^(i|i really|i actually) hate myself\b/,
  /^(im|i am|i feel|im feeling) (so |really |very |literally |completely )?(worthless|useless|a failure|a burden|unlovable|hopeless|empty|alone|lonely|not enough|a waste of space)\b/,
  /^i (feel like|think) (im|i am) (a burden|a failure|worthless|useless|unlovable|not enough)\b/,
  /^i (hate my life|cant cope|cannot cope|cant handle this anymore|cant take this anymore|want to disappear|feel invisible|feel left out)\b/,
  /^(nobody|no one) (likes|loves|wants|cares about) me\b/,
  /^everyone hates me\b/,
  /^i have (no friends|nobody|no one to talk to)\b/,
  /^my life (is|feels) (pointless|meaningless|a mess)\b/,
  /^(im|i am) (so |really )?(cooked|cooked fr|taking ls|an npc|a loser) (and |because )?(i )?(feel |feeling )?(worthless|hopeless|alone|unlovable)\b/,
  /^i (keep taking ls|have negative aura) (and |because )?(i )?(feel |feeling )?(worthless|hopeless|alone)\b/,
  /^i (get|am getting|keep getting) (bullied|body shamed|called ugly|called an npc|called a loser)\b/,
]

const FULL = [
  /^i (cant|cannot|dont think i can) keep myself safe\b/,
  /^i (dont|do not) feel safe with myself\b/,
  /^i (might|may|am about to|plan to|intend to|want to|wanna|will|am going to) (hurt|harm|kill|unalive) myself\b/,
  /^(im|i am) (about to|going to|planning to) (hurt|harm|kill|unalive) myself\b/,
  /^i (want to|wanna|will|am going to) (end my life|stop living|disappear forever)\b/,
  /^(im|i am) (going to|about to) (kms|end it all)\b/,
]

const REFUSE = [
  /^(help me|tell me how to|teach me to|how (do|can) i) (bully|harass|humiliate|dox|doxx|threaten|blackmail)\b/,
  /^(write|make|generate|give me) (a |an |some )?(message|messages|post|posts|insult|insults|roast|roasts) (to |that )?(bully|humiliate|harass|threaten|body shame)\b/,
  /^(tell|convince|encourage) (them|him|her|someone|my classmate) to (kys|kill themselves|kill himself|kill herself|self harm)\b/,
  /^you (should|need to|must) (kys|kill yourself|unalive yourself)\b/,
]

function verdict(action: SafetyVerdict["action"], reason: string): SafetyVerdict {
  return {
    action, reason, decidedBy: "rules",
    categories: action === "safeguarding" ? ["suicide_self_harm"] : action === "refuse" ? ["bullying_harassment"] : [],
    crisis: action === "safeguarding" ? "self_harm" : null,
  }
}

export function assessContextualSafety(text: string): SafetyVerdict | null {
  // Apostrophes stay within a clause; quotation marks suppress this additional
  // layer only. The existing classifier and provider still inspect all input.
  const clauses = text.split(/[\n.!?;,]+/).filter((clause) => !/["“”]/.test(clause))
    .map(normalizeForSafety)
    .map((clause) => clause.replace(/^(fr|ngl|lowkey|highkey|bruh)\s+/, ""))
  const matches = (patterns: RegExp[]) => clauses.some((clause) => patterns.some((pattern) => pattern.test(clause)))
  if (matches(FULL)) return verdict("safeguarding", "context:personal_danger")
  if (matches(REFUSE)) return verdict("refuse", "context:harmful_request")
  if (matches(GENTLE)) return verdict("gentle_support", "context:distress")
  return null
}
