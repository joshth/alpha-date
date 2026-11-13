const RULES: [RegExp, string][] = [
  [/\b[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+\s*(?:@|\[at\]|\(at\))\s*[A-Z0-9-]+(?:(?:\.|\s*(?:\[dot\]|\(dot\))\s*)[A-Z0-9-]+)+\b/gi, "[REDACTED_EMAIL]"],
  [/\b\d{3}-\d{2}-\d{4}\b/g, "[REDACTED_ID]"],
  [/\b[A-CEGHJ-PR-TW-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/gi, "[REDACTED_ID]"],
  [/\b(?:TFN|tax file number|Medicare(?: number)?|passport(?: number)?|driver'?s? licen[cs]e(?: number)?|government ID(?: number)?|national ID(?: number)?|SSN)\s*[:#=-]?\s*[A-Z]{0,3}[ -]?\d(?:[\d -]{4,16}\d)[A-Z]?\b/gi, "[REDACTED_ID]"],
  [/\b(?:unit|apt|apartment|flat|suite)\s+\w+[ ,]+\d{1,5}[A-Z]?(?:\/\d{1,5})?\s+(?:[\p{L}][\p{L}'’-]*\s+){1,5}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|crescent|cres|boulevard|blvd|way|place|pl|terrace|close)\b\.?/giu, "[REDACTED_ADDRESS]"],
  [/\b\d{1,5}[A-Z]?(?:\/\d{1,5})?\s+(?:[\p{L}][\p{L}'’-]*\s+){1,5}(?:street|st|road|rd|avenue|ave|lane|ln|drive|dr|court|ct|crescent|cres|boulevard|blvd|way|place|pl|terrace|close)\b\.?/giu, "[REDACTED_ADDRESS]"],
  [/\[REDACTED_ADDRESS\](?:,\s*[A-Z][A-Z .'’-]{0,40})?,?\s+(?:[A-Z]{2,3}\s+\d{4,5}(?:-\d{4})?|[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/gi, "[REDACTED_ADDRESS]"],
  [/\bP\.?\s*O\.?\s+box\s+\d+\b/gi, "[REDACTED_ADDRESS]"],
  [/(?<!\w)(?:\+\d{1,3}[ .-]?)?(?:\(\d{2,4}\)[ .-]?)?\d(?:[\d .-]{6,18}\d)(?!\w)/g, "[REDACTED_PHONE]"],
]

export function redactPersonalInformation(text: string): string {
  if (typeof text !== "string" || text.length > 10000) throw new Error("Could not inspect input safely.")
  let result = text.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/g, "")
  for (const [pattern, replacement] of RULES) {
    result = result.replace(pattern, match => {
      if (replacement !== "[REDACTED_PHONE]") return replacement
      const digits = match.replace(/\D/g, "").length
      return (digits >= 9 && digits <= 15) || /^\d{3}[ .-]\d{4}$/.test(match) ? replacement : match
    })
  }
  return result
}

export function redactTextFields<T>(value: T): T {
  if (typeof value === "string") return redactPersonalInformation(value) as T
  if (Array.isArray(value)) return value.map(redactTextFields) as T
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactTextFields(item)])) as T
  }
  return value
}
