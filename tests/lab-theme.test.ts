import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8").replace(/\r\n/g, "\n") : "")
const css = read("app/globals.css")
const tw = read("tailwind.config.ts")
const layout = read("app/lab/layout.tsx")

const frontMatter = read("DESIGN.md").match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? ""
const colors: Record<string, string> = {}
for (const m of frontMatter.matchAll(/^ {2}([a-z-]+): "(#[0-9a-fA-F]{6})"$/gm)) colors[m[1]] = m[2]
const names = Object.keys(colors)
const dark = names.filter((n) => !n.endsWith("-light"))
const light = names.filter((n) => n.endsWith("-light")).map((n) => n.replace(/-light$/, ""))

function hexToHsl(hex: string): number[] {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  let h = 0
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [Math.round(((h * 60) + 360) % 360), Math.round(s * 100), Math.round(l * 100)]
}

// text from `.lab {` to its closing brace (blocks are not nested)
const labBlocks = (src: string) => [...src.matchAll(/\.lab\s*\{([^}]*)\}/g)].map((m) => m[1])

function assertTokens(block: string, tokens: string[], hexOf: (n: string) => string) {
  for (const name of tokens) {
    const m = block.match(new RegExp(`--lab-${name}:\\s*(\\d+)\\s+(\\d+)%\\s+(\\d+)%\\s*;`))
    assert.ok(m, `--lab-${name} missing`)
    const want = hexToHsl(hexOf(name))
    want.forEach((w, i) => assert.ok(Math.abs(w - Number(m[i + 1])) <= 1, `--lab-${name} should be ~${want.join(" ")}`))
  }
}

test("hexToHsl converts the near-black and near-white greys", () => {
  assert.deepEqual(hexToHsl("#050506"), [240, 9, 2])
  assert.deepEqual(hexToHsl("#ececef"), [240, 9, 93])
})

test("DESIGN.md lists the dark and light tokens, with a light-mode colour for every Aura stage", () => {
  assert.equal(dark.length, 15)
  assert.equal(light.length, 14) // the ten surface/text tokens plus a darker light-mode colour for each Aura stage
})

test("globals.css .lab block defines every dark DESIGN.md token as HSL", () => {
  const block = labBlocks(css.split("@media (prefers-color-scheme: light)")[0])[0] ?? ""
  assert.ok(block, "no .lab block")
  assertTokens(block, dark, (n) => colors[n])
})

test("globals.css light media query overrides the light tokens", () => {
  const media = css.split("@media (prefers-color-scheme: light)")[1] ?? ""
  assert.ok(media, "no light media query")
  assertTokens(labBlocks(media)[0] ?? "", light, (n) => colors[`${n}-light`])
})

test(".lab remaps the shadcn variables onto the lab tokens", () => {
  const block = labBlocks(css)[0] ?? ""
  for (const d of [
    "--background: var(--lab-surface)", "--foreground: var(--lab-text)", "--border: var(--lab-border)",
    "--input: var(--lab-border-strong)", "--primary: var(--lab-primary)", "--ring: var(--lab-primary)",
    "--muted-foreground: var(--lab-text-muted)",
  ]) assert.ok(block.includes(d), d)
})

test("tailwind.config.ts exposes lab and stage colours and Plex fonts", () => {
  const map: Record<string, string> = {
    chrome: "chrome", surface: "surface", raised: "surface-raised", input: "input", border: "border",
    '"border-strong"': "border-strong", control: "control", text: "text", muted: "text-muted",
  }
  for (const [k, v] of Object.entries(map)) assert.ok(tw.includes(`${k}: "hsl(var(--lab-${v}))"`), `lab.${k}`)
  for (const [k, v] of Object.entries({ emerging: "emerging", peaking: "peaking", declining: "declining", parent: "parent-territory" }))
    assert.ok(tw.includes(`${k}: "hsl(var(--lab-stage-${v}))"`), `stage.${k}`)
  assert.match(tw, /sans:\s*\[\s*"var\(--font-plex-sans\)"/)
  assert.match(tw, /mono:\s*\[\s*"var\(--font-plex-mono\)"/)
})

test("app/lab/layout.tsx bundles licensed IBM Plex fonts without build-time Google requests", () => {
  assert.match(layout, /import localFont from "next\/font\/local"/)
  assert.doesNotMatch(layout, /next\/font\/google/)
  const fonts = [...layout.matchAll(/(?:src|path): "(\.\.\/\.\.\/fonts\/[^"\n]+\.ttf)"/g)].map(match => match[1])
  assert.equal(fonts.length, 4)
  for (const font of fonts) {
    const bytes = readFileSync("app/lab/" + font)
    assert.deepEqual([...bytes.subarray(0, 4)], [0, 1, 0, 0], `${font} must be an actual TrueType font`)
  }
  assert.match(read("fonts/OFL-IBM-Plex.txt"), /SIL OPEN FONT LICENSE Version 1.1/)

  assert.match(layout, /variable: "--font-plex-sans"/)
  assert.match(layout, /variable: "--font-plex-mono"/)
  assert.match(layout, /className=\{?[^>]*\blab\b/)
})


test("the calls-avoided badge also uses a bundled font", () => {
  const badge = read("components/search/ai-calls-avoided-badge.tsx")
  assert.match(badge, /next\/font\/local/)
  assert.doesNotMatch(badge, /next\/font\/google/)
  assert.match(badge, /weight: "900"/)
  assert.deepEqual([...readFileSync("fonts/Nunito-Variable.ttf").subarray(0, 4)], [0, 1, 0, 0])
  assert.match(read("fonts/OFL-Nunito.txt"), /SIL OPEN FONT LICENSE Version 1.1/)
})
