// Deterministic safety classifier (no model call): auditable, testable, and
// not open to prompt injection. Runs on user input before any AI call and on
// any term shown to a user. See docs/safety/.
//
// Two levels:
// - sensitive: the text is about a harmful topic (e.g. looking up "kms").
//   Show help-seeking information alongside the answer (Mindframe practice).
// - crisis: a first-person statement of intent to self-harm or to harm
//   others (e.g. "i want to kill myself"). No slang lookup or AI call is made;
//   a crisis card is shown and the event is recorded for human review.
//
// Patterns favour catching real signals over avoiding false positives, except
// for common hyperbole that is known slang ("i'm dead", "killing it").

export type SafetyCategory =
  | "suicide_self_harm"
  | "eating_disorder"
  | "sexual_exploitation"
  | "violence_threat"
  | "bullying_harassment"

export type CrisisKind = "self_harm" | "harm_to_others"

export interface SafetyAssessment {
  categories: SafetyCategory[]
  crisis: CrisisKind | null
}

const LEET: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", $: "s", "!": "i" }

// Lower-case, strip accents, undo common character swaps used to evade
// filters ("su1c1de", "unal!ve"), drop masking symbols and squeeze letters
// repeated 3+ times ("diiiie" -> "die"), so patterns see a plain form.
export function normalizeForSafety(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[0134573@$!]/g, (c) => LEET[c] ?? c)
    .replace(/[*_.'’`~^-]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/(\p{L})\1{2,}/gu, "$1")
    .trim()
}

function any(patterns: RegExp[], text: string): boolean {
  return patterns.some((p) => p.test(text))
}

const SELF_HARM_TOPIC: RegExp[] = [
  /\bsuicid(e|al)\b/,
  /\bsoicide\b/,
  /\bsewer ?slide\b/,
  /\bunaliv(e|ed|es|ing)\b/,
  /\bkms\b/,
  /\bkys\b/,
  /\bkill (my|your|ur|him|her|them) ?sel(f|ves)\b/,
  /\bkill urself\b/,
  /\bkeep (yourself|ur ?self|urself) safe\b/,
  /\bneck (my|your|ur) ?self\b/,
  /\ban hero\b/,
  /\bself ?(harm|harming|injury|injure)\b/,
  /\bcut(ting)? (my|your|ur) ?(self|selves|wrists?|arms?)\b/,
  /\bend (it all|my life|your life)\b/,
  /\b(want|wanna|wanting) (to )?die\b/,
  /\bwish (i|u|you) (was|were) dead\b/,
  /\bbetter off dead\b/,
  /\b(no reason|nothing) to live\b/,
  /\bdont want to (live|be alive|exist)\b/,
]

// Separate from self-harm so the eating-disorder helpline is offered (the
// eSafety DIS code treats eating-disorder content as its own class).
const EATING_DISORDER_TOPIC: RegExp[] = [
  /\bpro ?(ana|mia)\b/,
  /\bana (coach|buddy|tips)\b/,
  /\b(thinspo|thinspiration|meanspo|bonespo|skinnytok|edtwt)\b/,
  /\beating disorders?\b/,
  /\b(anorexi(a|c)|bulimi(a|c))\b/,
]

const EXPLOITATION_TOPIC: RegExp[] = [
  /\bsextort(ion|ed|ing)?\b/,
  /\bsend (me )?(nudes|noodz)\b/,
  /\b(nudes|noodz)\b/,
  /\bnude (pics?|photos?|images?)\b/,
  /\bsexting\b/,
  // Bare "grooming" is usually personal grooming ("basic grooming and fitness").
  /\b(online|child|sexual) grooming\b/,
  /\bgroom(ing|ed|s)? (a |the |young |)?(child|children|kid|kids|minor|minors|teen|teens|student|students|victim|victims)\b/,
  /\bgroomers?\b/,
  /\bchild (porn|pornography|abuse material)\b/,
  /\bcsam\b/,
  /\bcsem\b/,
  /\brape(d|s)?\b/,
]

const VIOLENCE_TOPIC: RegExp[] = [
  /\bschool shoot(ing|er)\b/,
  /\bshoot(ing)? up (the |my |a )?(school|class|mall)\b/,
  /\bmass shoot(ing|er)\b/,
]

const BULLYING_TOPIC: RegExp[] = [
  /\bkys\b/,
  /\bkill (your|ur) ?self\b/,
  /\bkill urself\b/,
  /\bkeep (yourself|ur ?self|urself) safe\b/,
  /\bneck (your|ur) ?self\b/,
  /\bunalive (your|ur) ?self\b/,
  /\bgo die\b/,
  /\bnobody (likes|loves|wants) (you|u)\b/,
]

// A first-person subject is required ("he's going to die" is not intent).
const FIRST_PERSON = String.raw`\b(i|im|imma|ima|i am|i m|ill|i will|i shall|i need to|i want to|i wanna)\b`

const SELF_HARM_INTENT: RegExp[] = [
  new RegExp(`${FIRST_PERSON}.{0,30}\\b(kill|unalive|end|hurt|harm|cut) (my ?self|me|my life)\\b`),
  // Bare "die" is left out: "i'm gonna die if he texts me" is hyperbole.
  new RegExp(`${FIRST_PERSON}.{0,30}\\b(kms|end it all|commit suicide|suicide)\\b`),
  /\b(i|im|i am|i m|i feel|feeling) (so |really |very )?suicidal\b/,
  /\b(i )?(want|wanna|wanting) (to )?(die|end it|end my life|kill myself|unalive myself)\b/,
  /\bwish i (was|were) dead\b/,
  /\bi (dont|do not) want to (live|be alive|exist) (anymore|any more)?\b/,
  /\bno reason (for me )?to live\b/,
]

// Idioms excluded: "kill it at school", "shoot my shot with everyone".
const HARM_VERB = String.raw`\b(shoot|stab|kill|murder|bomb|blow up|attack|hurt)\b(?! (it|my shot|your shot|ur shot|a shot|hoops|some hoops)\b)`

const HARM_OTHERS_INTENT: RegExp[] = [
  new RegExp(
    `${FIRST_PERSON}.{0,30}${HARM_VERB}.{0,30}\\b(school|class|classmates?|teachers?|students?|everyone|every one|them all|people|kids)\\b`,
  ),
  new RegExp(`${FIRST_PERSON}.{0,20}\\b(shoot up|bring a gun to|bomb) (the |my |our )?(school|class)\\b`),
]

// Known hyperbole that is ordinary slang, not intent.
const HYPERBOLE: RegExp[] = [
  /^(i m|im|i am) (so |literally )?dead( lol| lmao| haha)?$/,
  /\b(killing|killed|kill) it\b/,
  /\bdead ?ass\b/,
  /\bi m dying\b|\bim dying\b/,
]

export function assessSafety(text: string | null | undefined): SafetyAssessment {
  const t = normalizeForSafety(text ?? "")
  if (!t) return { categories: [], crisis: null }

  const categories = new Set<SafetyCategory>()
  if (any(SELF_HARM_TOPIC, t)) categories.add("suicide_self_harm")
  if (any(EATING_DISORDER_TOPIC, t)) categories.add("eating_disorder")
  if (any(EXPLOITATION_TOPIC, t)) categories.add("sexual_exploitation")
  if (any(VIOLENCE_TOPIC, t)) categories.add("violence_threat")
  if (any(BULLYING_TOPIC, t)) categories.add("bullying_harassment")

  let crisis: CrisisKind | null = null
  const hyperbole = any(HYPERBOLE, t) && !any(SELF_HARM_INTENT, t)
  if (!hyperbole && any(SELF_HARM_INTENT, t)) {
    crisis = "self_harm"
    categories.add("suicide_self_harm")
  }
  if (any(HARM_OTHERS_INTENT, t)) {
    crisis = "harm_to_others"
    categories.add("violence_threat")
  }
  return { categories: [...categories], crisis }
}

// A term (or AI answer) is sensitive if its name, definition or tags touch a
// harmful topic, or it carries a restrictive rating. Cautionary notes are not
// scanned: they often say what a term is NOT ("should not be mistaken for a
// sign of self-harm"), and keyword rules can't read negation.
const RESTRICTIVE_RATINGS = new Set(["Mature Themes", "Offensive", "Vulgar"])

export function assessTermSafety(term: {
  term: string
  definition?: string | null
  tags?: string[] | null
  cautionaryNotes?: string | null
  sensitivityRating?: string | null
}): { categories: SafetyCategory[]; restrictedRating: boolean } {
  const text = [term.term, term.definition, (term.tags ?? []).join(" ")].filter(Boolean).join(" \n ")
  const { categories } = assessSafety(text)
  return { categories, restrictedRating: RESTRICTIVE_RATINGS.has(term.sensitivityRating ?? "") }
}

// Needs human review before being published to everyone.
export function requiresHumanReview(term: Parameters<typeof assessTermSafety>[0]): boolean {
  const { categories, restrictedRating } = assessTermSafety(term)
  return restrictedRating || categories.length > 0
}
