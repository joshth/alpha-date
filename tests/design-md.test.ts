import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"

const design = existsSync("DESIGN.md") ? readFileSync("DESIGN.md", "utf8") : ""
const frontMatter = design.match(/^---\n([\s\S]*?)\n---\n/)?.[1] ?? ""

// Measured from the reference dashboard screenshot (Feature 9 design brief).
const MEASURED = {
  chrome: "#050506",
  surface: "#18171d",
  "surface-raised": "#28272d",
  input: "#1a191d",
  border: "#3e3d43",
  control: "#4f4e53",
  text: "#ececef",
  "text-muted": "#979699",
}

// Okabe-Ito, colour-blind safe, one per Aura stage.
const STAGES = {
  "stage-emerging": "#009E73",
  "stage-peaking": "#E69F00",
  "stage-declining": "#56B4E9",
  "stage-parent-territory": "#CC79A7",
}

test("DESIGN.md has the measured dashboard tokens as YAML front matter", () => {
  assert.ok(frontMatter, "DESIGN.md needs a --- front matter block")
  for (const [name, hex] of Object.entries(MEASURED)) {
    assert.match(frontMatter, new RegExp(`^  ${name}: "${hex}"$`, "mi"), name)
  }
})

test("DESIGN.md gives every Aura stage its Okabe-Ito colour", () => {
  for (const [name, hex] of Object.entries(STAGES)) {
    assert.match(frontMatter, new RegExp(`^  ${name}: "${hex}"$`, "mi"), name)
  }
})

test("DESIGN.md sets IBM Plex Sans for the UI and IBM Plex Mono for figures", () => {
  assert.match(frontMatter, /fontFamily: IBM Plex Sans/)
  assert.match(frontMatter, /fontFamily: IBM Plex Mono/)
  assert.match(frontMatter, /fontFeature: "?'tnum'"?/)
})

test("DESIGN.md sections follow the format's order and include the ban list", () => {
  const order = ["Overview", "Colors", "Typography", "Layout", "Elevation & Depth", "Shapes", "Components", "Do's and Don'ts"]
  const at = order.map((h) => design.indexOf(`\n## ${h}`))
  assert.ok(at.every((i) => i > 0), `missing section: ${order[at.findIndex((i) => i <= 0)]}`)
  assert.deepEqual([...at].sort((a, b) => a - b), at)
  assert.match(design, /purple or indigo gradients/i)
})
