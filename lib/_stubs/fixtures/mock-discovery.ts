import type { DiscoveryOutput } from "@/lib/discovery/prompt"

// Mock discovery model. It behaves like a plausible but imperfect model so the
// evaluation harness has real errors to find:
// - it knows a fixed list of genuine slang (below);
// - it HALLUCINATES: accepts invented words that merely look slang-like
//   (ending in -maxxing/-core/-pilled, or containing "zz"), with made-up meanings;
// - it MISSES some real slang (anything not in its list);
// - it MISLABELS sensitivity for a couple of terms (rates them harmless).
// Every definition starts with "[Mock]". Do not tune your harness to this
// file's quirks — measure the real model too (MOCK_LLM=false, your own key).

const KNOWN: Record<string, { definition: string; rating: DiscoveryOutput["sensitivityRating"]; sentiment?: DiscoveryOutput["commonSentiment"] }> = {
  "rizzler": { definition: "Someone with a lot of rizz (charm).", rating: "Generally Harmless", sentiment: "Positive" },
  "aura farming": { definition: "Doing things deliberately to look cool and gain 'aura'.", rating: "Generally Harmless", sentiment: "Mixed" },
  "brainrot": { definition: "Low-quality online content, or the feeling of being dulled by too much of it.", rating: "Generally Harmless", sentiment: "Negative" },
  "brain rot": { definition: "Low-quality online content, or the feeling of being dulled by too much of it.", rating: "Generally Harmless", sentiment: "Negative" },
  "crash out": { definition: "To lose control emotionally or act recklessly after being upset.", rating: "Use With Caution", sentiment: "Negative" },
  "glazing": { definition: "Excessively praising or flattering someone.", rating: "Generally Harmless", sentiment: "Mixed" },
  "huzz": { definition: "A slang word for a group of girls, often used in a crude way.", rating: "Use With Caution", sentiment: "Mixed" },
  "mewing": { definition: "A tongue-posture trend claimed to sharpen the jawline.", rating: "Generally Harmless", sentiment: "Neutral" },
  "chopped": { definition: "Unattractive or looking bad.", rating: "Use With Caution", sentiment: "Negative" },
  "tuff": { definition: "Impressive or cool.", rating: "Generally Harmless", sentiment: "Positive" },
  "six seven": { definition: "A nonsense meme phrase shouted for fun, from a viral song lyric.", rating: "Generally Harmless", sentiment: "Neutral" },
  "fanum tax": { definition: "Taking a bite of a friend's food as a joking 'tax'.", rating: "Generally Harmless", sentiment: "Positive" },
  "looksmaxxing": { definition: "Trying to maximise physical attractiveness, sometimes in unhealthy ways.", rating: "Use With Caution", sentiment: "Mixed" },
  "mogging": { definition: "Outshining someone, especially in looks.", rating: "Use With Caution", sentiment: "Mixed" },
  "yap": { definition: "To talk a lot, often without saying much.", rating: "Generally Harmless", sentiment: "Neutral" },
  "goated": { definition: "The greatest; extremely good at something.", rating: "Generally Harmless", sentiment: "Positive" },
  "bombastic side eye": { definition: "An exaggerated sceptical look at something questionable.", rating: "Generally Harmless", sentiment: "Mixed" },
  "unalive": { definition: "Algospeak for killing or dying, used to avoid filters.", rating: "Generally Harmless", sentiment: "Negative" }, // deliberate mislabel
  "sewerslide": { definition: "Algospeak for a sensitive topic.", rating: "Generally Harmless", sentiment: "Negative" }, // deliberate mislabel
}

const HALLUCINATION_PATTERNS = [/maxxing$/, /core$/, /pilled$/, /zz/]

export function mockDiscovery(searchTerm: string): DiscoveryOutput {
  const key = searchTerm.trim().toLowerCase()
  const known = KNOWN[key]
  if (known) {
    return {
      isLegit: true,
      definition: `[Mock] ${known.definition}`,
      examples: [`[Mock] "That's so ${key}."`],
      originAndContext: "[Mock] Spread through short-form video and gaming chats.",
      commonSentiment: known.sentiment ?? "Neutral",
      sensitivityRating: known.rating,
    }
  }
  if (HALLUCINATION_PATTERNS.some((p) => p.test(key)) && /^[a-z ]{3,30}$/.test(key)) {
    return {
      isLegit: true,
      definition: `[Mock] A trend where people exaggerate "${key}" behaviour online for laughs.`,
      examples: [`[Mock] "Stop ${key}, it's embarrassing."`],
      originAndContext: "[Mock] Emerged on TikTok in 2025.",
      commonSentiment: "Mixed",
      sensitivityRating: "Generally Harmless",
    }
  }
  return { isLegit: false }
}
