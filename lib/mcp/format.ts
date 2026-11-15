// A11Y-15: MCP answers are read by screen readers, braille displays and voice, so plain text only.
export const MAX_SUMMARY = 80
/** Longer lines are split at sentence ends so a braille display never gets one huge paragraph. */
export const MAX_LINE = 400

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
  return [first, ...details.map(plainText).filter(Boolean)].join("\n").split("\n").flatMap(splitLongLine).join("\n")
}

function splitLongLine(line: string): string[] {
  if (line.length <= MAX_LINE) return [line]
  const lines: string[] = []
  for (const sentence of line.split(/(?<=[.!?])\s+/)) {
    const last = lines.at(-1)
    if (last !== undefined && last.length + 1 + sentence.length <= MAX_LINE) lines[lines.length - 1] = `${last} ${sentence}`
    else lines.push(sentence)
  }
  return lines
}
