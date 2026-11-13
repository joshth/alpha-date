const COMMANDS = [
  /\b(?:ignore|disregard|forget|override|bypass)\b.{0,50}\b(?:instructions?|prompts?|rules?|safety|guardrails?|system)\b/,
  /\b(?:reveal|print|show|leak|expose|send)\b.{0,40}\b(?:system prompt|api keys?|secrets?|credentials?|environment variables?)\b/,
  /\b(?:delete|drop|truncate|wipe|erase|destroy)\b.{0,50}\b(?:database|tables?|records?|users?|data|backend|back[ -]?end|data base)\b/,
  /\b(?:alter|modify|rewrite|replace|disable|change|hack)\b.{0,45}\b(?:system prompt|backend|back end|website|source code|database schema|safety checks?|ai|model)\b/,
  /\b(?:execute|run)\b.{0,30}\b(?:sql|shell|commands?|scripts?|rm\s+-rf)\b/,
  /\b(?:you are now|act as)\b.{0,25}\b(?:system|developer|admin|unrestricted|dan)\b/,
  /<\/?(?:system|developer|assistant|user_input)\b|\[inst\]|\[\/?system\]|\[im_start\]|\[im_end\]/,
]

export function isPromptInjection(text: string): boolean {
  let normalized = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
  for (let i = 0; i < 2; i++) {
    try { normalized = decodeURIComponent(normalized) } catch { break }
  }
  normalized = normalized.toLowerCase().replace(/\s+/g, " ")
  return COMMANDS.some(pattern => pattern.test(normalized))
}
