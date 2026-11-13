// A11Y-15: MCP answers are read by screen readers, braille displays and voice, so plain text only.
export const MAX_SUMMARY = 80

export function plainText(text: string): string {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\*\*|__|`/g, "")
    .replace(/\s*\|\s*/g, ", ")
    .split("\n")
    .map((line) => line.replace(/^\s*(#+|>)\s*/, "").replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .trim()
}

export function answer(summary: string, details: string[]): string {
  const s = plainText(summary).replace(/\n+/g, " ")
  const first = s.length > MAX_SUMMARY ? s.slice(0, MAX_SUMMARY - 3) + "..." : s
  return [first, ...details.map(plainText).filter(Boolean)].join("\n")
}
