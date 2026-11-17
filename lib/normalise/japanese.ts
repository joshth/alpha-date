// Japanese key folding for suggestions: katakana become hiragana, and a text that
// is only number readings (ろくなな, ロクナナ, 六七) becomes digits ("67").

const KANJI_DIGITS = "〇一二三四五六七八九"
// Longest reading first so "ご" never eats the start of "ごじゅう".
const READINGS: [string, number][] = [
  ["きゅう", 9], ["ぜろ", 0], ["れい", 0], ["いち", 1], ["さん", 3], ["よん", 4], ["ろく", 6], ["しち", 7], ["なな", 7], ["はち", 8],
  ["に", 2], ["し", 4], ["ご", 5], ["く", 9],
]

const toHiragana = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))

function readingsToDigits(s: string): string | null {
  let out = ""
  for (let i = 0; i < s.length; ) {
    const k = KANJI_DIGITS.indexOf(s[i])
    if (k >= 0) { out += k; i++; continue }
    const hit = READINGS.find(([r]) => s.startsWith(r, i))
    if (!hit) return null
    out += hit[1]
    i += hit[0].length
  }
  return out
}

export function foldJapanese(text: string): string {
  const kana = toHiragana(text.trim())
  return (kana && readingsToDigits(kana)) ?? kana
}
