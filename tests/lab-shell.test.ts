import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { LAB_NAV } from "../components/lab/nav"

const root = { href: "/lab", label: "Lexicon Lab" }
let cached: { crumbs: { href: string; label: string }[][]; aura: string; dash: string } | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { LabShellView, breadcrumbs } = require("./components/lab/shell.tsx");
  globalThis.React = React;
  const view = (pathname) => renderToStaticMarkup(React.createElement(LabShellView, {
    pathname, userName: "Mock Reviewer", mockLlm: true, children: React.createElement("p", null, "PAGE BODY"),
  }));
  console.log(JSON.stringify({
    crumbs: ["/lab", "/lab/aura", "/lab/review/123", "/lab/nope"].map(breadcrumbs),
    aura: view("/lab/aura"), dash: view("/lab"),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

const items = LAB_NAV.flatMap((g) => g.items)
const label = (href: string) => items.find((i) => i.href === href)!.label
const current = (html: string) =>
  (html.match(/<a [^>]*>/g) ?? []).filter((a) => /aria-current="page"/.test(a))

test("breadcrumbs: root plus the matching nav page", () => {
  const { crumbs } = run()
  assert.deepEqual(crumbs[0], [root])
  assert.deepEqual(crumbs[1], [root, { href: "/lab/aura", label: label("/lab/aura") }])
  const review = items.find((i) => i.href === "/lab/review")!
  assert.deepEqual(crumbs[2], [root, { href: review.href, label: review.label }])
  assert.deepEqual(crumbs[3], [root])
})

test("LabShellView renders header, search, avatar, nav, breadcrumb and main", () => {
  const { aura: html } = run()
  assert.match(html, /<header[^>]*>[\s\S]*Lexicon Lab[\s\S]*<\/header>/)
  const header = html.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? ""
  assert.ok(header.includes("Teaching scaffold"), "scaffold banner inside <header>")
  assert.ok(header.includes("Lexicon Lab"), "Lexicon Lab inside <header>")
  assert.match(header, /<form[^>]*role="search"/)
  const form = html.match(/<form[^>]*>/)?.[0] ?? ""
  assert.match(form, /role="search"/)
  assert.match(form, /action="\/lab\/search"/)
  const input = html.match(/<input[^>]*name="q"[^>]*>/)?.[0] ?? ""
  assert.match(input, /placeholder="Search or go to…"/)
  assert.match(input, /aria-keyshortcuts="\/"/)
  const id = input.match(/id="([^"]+)"/)?.[1]
  assert.ok(id && html.includes(`for="${id}"`), "search input has a <label for>")
  assert.match(html, /title="Mock Reviewer"[^>]*>MR</)
  const nav = html.match(/<nav aria-label="Lab"[\s\S]*?<\/nav>/)?.[0] ?? ""
  for (const g of LAB_NAV) {
    assert.ok(nav.includes(g.label), g.label)
    for (const i of g.items) assert.ok(nav.includes(`>${i.label}<`), i.label)
  }
  assert.deepEqual(current(html).map((a) => a.match(/href="([^"]+)"/)?.[1]), ["/lab/aura"])
  assert.match(html, /<button[^>]*aria-expanded="true"[^>]*>[\s\S]*?Collapse sidebar/)
  const crumb = html.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? ""
  assert.match(crumb, /<ol[\s\S]*href="\/lab"[^>]*>Lexicon Lab<[\s\S]*<span aria-current="page"[^>]*>Aura<\/span>[\s\S]*<\/ol>/)
  assert.match(html, /<main id="main-content"[^>]*>[\s\S]*PAGE BODY/)
  assert.match(html, /Teaching scaffold/)
  assert.doesNotMatch(html, /(class|style)="[^"]*#[0-9a-fA-F]{3,6}\b/)
})

test("Dashboard link is current on /lab", () => {
  const { dash } = run()
  assert.ok(current(dash).some((a) => a.includes('href="/lab"')))
  assert.ok(!current(dash).some((a) => a.includes('href="/lab/aura"')))
})
