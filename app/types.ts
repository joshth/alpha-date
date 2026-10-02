export type SensitivityRating = "Vulgar" | "Offensive" | "Mature Themes" | "Use With Caution" | "Generally Harmless"

export type CommonSentiment = "Positive" | "Negative" | "Neutral" | "Variable" | "Objectifying" | "Humorous/Playful"

export type SupportedLanguage =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "pt"
  | "it"
  | "zh"
  | "ja"
  | "ko"
  | "ar"
  | "hi"

export interface TranslatedContent {
  language: SupportedLanguage
  definition: string
  examples: string[]
  originAndContext: string
  cautionaryNotes?: string
  detailedOriginEtymology?: string
  culturalImpactAnalysis?: string
  communicationTips?: string
}

export interface SlangTerm {
  id: string
  term: string
  pronunciation?: string
  definition: string
  examples: string[]
  originAndContext: string
  // Kept as string (not CommonSentiment) so legacy localStorage entries and
  // off-enum LLM output degrade gracefully instead of failing at runtime.
  commonSentiment: string
  sensitivityRating: SensitivityRating
  // null is allowed because the LLM population schema is .nullish() and the
  // seed data mirrors its raw output.
  cautionaryNotes?: string | null
  tags?: string[]
  detailedOriginEtymology?: string
  culturalImpactAnalysis?: string
  communicationTips?: string
  educatorDiscussionPoints?: {
    ageGroup: string
    prompt: string
  }[]
  translatedContent?: TranslatedContent
}
