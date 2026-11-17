export const GPT4O_MINI_PRICING = {
  inputPerMillionUsd: 0.15,
  outputPerMillionUsd: 0.60,
  source: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
  checkedOn: "2026-11-16",
} as const

export function estimateGpt4oMiniSavings(calls: number, inputTokens: number, outputTokens: number) {
  if (![calls, inputTokens, outputTokens].every(value => Number.isSafeInteger(value) && value >= 0)) return null
  const averageCostUsd = (inputTokens * GPT4O_MINI_PRICING.inputPerMillionUsd + outputTokens * GPT4O_MINI_PRICING.outputPerMillionUsd) / 1_000_000
  const savingsUsd = calls * averageCostUsd
  return Number.isFinite(savingsUsd) ? {averageCostUsd, savingsUsd} : null
}
