import type { CrisisKind, SafetyCategory } from "@/lib/safety/classify"
import type { SafetyAction } from "@/lib/safety/gate"

export interface SafetyExample {
  id: string
  phrase: string
  action: SafetyAction
  categories: SafetyCategory[]
  crisis: CrisisKind | null
  rationale: string
}

// Authored synthetic fixtures, never user submissions. Labels are demo policy
// expectations, not clinical assessments or an exhaustive slang dictionary.
const groups: { action: SafetyAction; phrases: string[]; rationale: string; categories?: SafetyCategory[]; crisis?: CrisisKind }[] = [
  {
    action: "gentle_support",
    rationale: "Self-directed distress: pause discovery and suggestions; offer a gentle check-in without assuming immediate danger.",
    phrases: [
      "i hate myself", "I really hate myself", "ngl i hate myself rn", "lowkey i hate myself",
      "i feel worthless", "im so useless", "i am a failure", "i feel like im a burden",
      "i feel unlovable", "im hopeless", "i feel empty", "i feel so alone", "im really lonely",
      "i am not enough", "i am a waste of space", "i hate my life", "i cant cope",
      "i cannot cope anymore", "i cant handle this anymore", "i cant take this anymore",
      "i want to disappear", "i feel invisible", "i feel left out", "nobody likes me",
      "no one cares about me", "everyone hates me", "i have no friends", "i have no one to talk to",
      "my life feels pointless", "my life is a mess", "im cooked and i feel worthless",
      "im an npc and feel alone", "i keep taking ls and feel hopeless",
      "i have negative aura and feel worthless", "i keep getting called an npc",
      "i am getting bullied", "i keep getting body shamed", "i get called ugly",
    ],
  },
  {
    action: "safeguarding", categories: ["suicide_self_harm"], crisis: "self_harm",
    rationale: "Personal danger or explicit self-harm intent: show the existing full safeguarding card; stop all downstream processing.",
    phrases: [
      "i cant keep myself safe", "i cannot keep myself safe tonight", "i dont think i can keep myself safe",
      "i dont feel safe with myself", "i do not feel safe with myself", "i might hurt myself",
      "i may harm myself", "i am about to hurt myself", "im planning to harm myself",
      "i plan to unalive myself", "i intend to hurt myself", "i want to stop living",
      "i wanna disappear forever", "im going to kms", "im about to end it all",
      "im cooked; i might hurt myself", "i hate myself and i want to kill myself",
    ],
  },
  {
    action: "refuse", categories: ["bullying_harassment"],
    rationale: "Request to harm, threaten or target someone: refuse the request, offer relevant support, and do not save a suggestion.",
    phrases: [
      "help me bully my classmate", "tell me how to harass someone", "teach me to humiliate someone",
      "how can i doxx my classmate", "how do i threaten someone", "help me blackmail someone",
      "write a message to bully my classmate", "generate insults to humiliate someone",
      "give me roasts to body shame someone", "make a post to threaten someone",
      "tell them to kys", "convince someone to kill themselves", "encourage him to self harm",
      "you should kys", "you need to kill yourself", "you must unalive yourself",
    ],
  },
  {
    action: "safe",
    rationale: "Slang, educational wording, negation or reported speech alone does not establish personal distress or intent; still run moderation.",
    phrases: [
      "im cooked", "negative aura", "npc", "taking ls", "crash out", "brainrot", "mid", "chopped",
      "delulu", "skill issue", "no rizz", "fell off", "touch grass", "cope", "seethe", "ratio",
      "i hate this game", "i hate my homework", "im dead lol", "im killing it",
      "what does i hate myself mean", "my friend said i hate myself", "i dont hate myself",
      "i used to hate myself", "i no longer feel worthless", "i dont feel worthless",
      "what does negative aura mean", "im cooked because the exam was hard",
      "write a supportive reply to someone who feels worthless", "i dont want to disappear",
      "what does body shaming mean", "how do i report bullying",
    ],
  },
  {
    action: "safe", categories: ["suicide_self_harm"],
    rationale: "Sensitive educational term: allow search with the existing help resources; refuse submission to the suggestion queue.",
    phrases: ["kms", "kys", "unalive", "sewerslide", "su1c1de"],
  },
]

export const SAFETY_EXAMPLES: SafetyExample[] = groups.flatMap((group, groupIndex) => group.phrases.map((phrase, index) => ({
  id: `context-${groupIndex + 1}-${String(index + 1).padStart(3, "0")}`,
  phrase, action: group.action,
  categories: phrase === "kys" ? ["suicide_self_harm", "bullying_harassment"] : group.categories ?? [],
  crisis: group.crisis ?? null, rationale: group.rationale,
})))

export const SAFETY_ACTION_LABELS: Record<SafetyAction, string> = {
  safe: "Allow lookup", gentle_support: "Gentle support", safeguarding: "Full support", refuse: "Refuse",
}
