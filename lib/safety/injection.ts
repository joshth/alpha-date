const COMMANDS: [string, RegExp][] = [
  ["instruction_override", /\b(?:ignore|disregard|forget|override|bypass)\b.{0,50}\b(?:instructions?|prompts?|rules?|safety|guardrails?|system)\b/],
  ["secret_extraction", /\b(?:reveal|print|show|leak|expose|send)\b.{0,40}\b(?:system prompt|api keys?|secrets?|credentials?|environment variables?)\b/],
  ["destructive_command", /\b(?:delete|drop|truncate|wipe|erase|destroy)\b.{0,50}\b(?:database|tables?|records?|users?|data|backend|back[ -]?end|data base)\b/],
  ["information_removal", /\b(?:remove|clear|delete|wipe|erase)\b.{0,30}\b(?:information|data|records?|memory)\b.{0,25}\b(?:from|in|on)\s+(?:your|the|this)\s+(?:system|database|backend|back[ -]?end)\b/],
  ["system_modification", /\b(?:alter|modify|rewrite|replace|disable|change|hack)\b.{0,45}\b(?:system prompt|backend|back end|website|source code|database schema|safety checks?|ai|model)\b/],
  ["tool_execution", /\b(?:execute|run)\b.{0,30}\b(?:sql|shell|commands?|scripts?|rm\s+-rf)\b/],
  ["role_hijack", /\b(?:you are now|act as)\b.{0,25}\b(?:system|developer|admin|unrestricted|dan)\b/],
  ["role_delimiter", /<\/?(?:system|developer|assistant|user_input)\b|\[inst\]|\[\/?system\]|\[im_start\]|\[im_end\]/],
  ["information_reset", /\b(?:delete|remove|clear|erase|wipe)\b.{0,30}\byour\s+(?:existing\s+|stored\s+|previous\s+)?(?:information|memory)\b/],
  ["instruction_deletion", /\b(?:delete|remove|clear|erase)\b.{0,40}\b(?:previous|prior|existing|all|your)\b.{0,25}\b(?:commands?|instructions?|prompts?)\b/],
  ["forced_classification", /\b(?:always|regardless|no matter what)\b.{0,45}\b(?:islegit|isrealslang|classify.{0,15}(?:real|safe)|return.{0,15}true)\b/],
  ["replacement_instructions", /\b(?:follow|obey|use)\b.{0,25}\b(?:these|my|new)\b.{0,20}\binstructions\b.{0,30}\b(?:instead|only|above|priority)\b/],
  ["unrestricted_mode", /\b(?:enable|enter|activate|switch to)\b.{0,25}\b(?:developer mode|admin mode|jailbreak|unrestricted mode)\b/],
  ["data_exfiltration", /\b(?:upload|forward|transmit|send)\b.{0,40}\b(?:secrets?|credentials?|database contents|api keys?)\b/],
]

export const PROMPT_INJECTION_THRESHOLD = 0.7
export const MAX_INJECTION_INPUT_LENGTH = 10000

export interface InjectionAssessment {
  score: number
  threshold: number
  unsafe: boolean
  signals: string[]
}

export function detectPromptInjection(text: string, threshold = PROMPT_INJECTION_THRESHOLD): InjectionAssessment {
  if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) throw new RangeError("Threshold must be greater than 0 and at most 1.")
  if (text.length > MAX_INJECTION_INPUT_LENGTH) return {score: 1, threshold, unsafe: true, signals: ["input_limit"]}
  let decoded = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
  for (let i = 0; i < 2; i++) {
    try { decoded = decodeURIComponent(decoded) } catch { break }
  }
  decoded = decoded.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
  const normalized = decoded.toLowerCase().replace(/\s+/g, " ")
  const signals = COMMANDS.filter(([, pattern]) => pattern.test(normalized)).map(([name]) => name)
  let score = signals.length ? 0.9 : 0
  if (!signals.length && /\b(?:system prompt|developer instructions|api keys?|jailbreak|guardrails)\b/.test(normalized)) {
    signals.push("sensitive_instruction_terms")
    score = 0.35
  }
  const whitespace = decoded.match(/\s/g)?.length ?? 0
  if (/\s{256}/.test(decoded)) {
    signals.push("extreme_whitespace")
    score += 0.7
  } else if (/\s{32}/.test(decoded) || (whitespace >= 64 && whitespace / decoded.length >= 0.6)) {
    signals.push("whitespace_padding")
    score += 0.4
  }
  if (decoded.length >= 2000) {
    signals.push("long_input")
    score += 0.3
  }
  // Heuristic risk, not a probability learned from labelled attack data.
  score = Math.min(1, Math.round(score * 100) / 100)
  return {score, threshold, unsafe: score >= threshold, signals}
}

export function isPromptInjection(text: string): boolean {
  return detectPromptInjection(text).unsafe
}
