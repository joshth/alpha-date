import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { LAB_NAV } from "../components/lab/nav"

const root = { href: "/lab", label: "Lexicon Lab" }
let cached: { crumbs: { href: string; label: string }[][]; aura: string; auraTerm: string; dash: string } | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { LabShellView, breadcrumbs } = require("./components/lab/shell.tsx");
  globalThis.React = React;
  const view = (pathname) => renderToStaticMarkup(React.createElement(LabShellView, {
    pathname, userName: "Mock Reviewer", mockLlm: true, children: React.createElement("p", null, "PAGE BODY"),
  }));
  console.log(JSON.stringify({
    crumbs: ["/lab", "/lab/aura", "/lab/aura/rizz%20roll", "/lab/review/123", "/lab/nope"].map(breadcrumbs),
    aura: view("/lab/aura"), auraTerm: view("/lab/aura/rizz%20roll"), dash: view("/lab"),
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
  assert.deepEqual(crumbs[2], [root, { href: "/lab/aura", label: label("/lab/aura") }, { href: "/lab/aura/rizz%20roll", label: "rizz roll" }])
  const review = items.find((i) => i.href === "/lab/review")!
  assert.deepEqual(crumbs[3], [root, { href: review.href, label: review.label }])
  assert.deepEqual(crumbs[4], [root])
})

test("Aura term breadcrumb includes a back link before its current path", () => {
  const html = run().auraTerm
  const crumb = html.match(/<nav aria-label="Breadcrumb"[\s\S]*?<\/nav>/)?.[0] ?? ""
  assert.match(crumb, /aria-label="Back to Aura dashboard"/)
  assert.ok(crumb.indexOf('aria-label="Back to Aura dashboard"') < crumb.indexOf("<ol"))
  assert.match(crumb, /<span aria-current="page">rizz roll<\/span>/)
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
    for (const i of g.items.filter((x) => !x.demoOnly)) {
      assert.ok(nav.includes(`>${i.label}</span>`), i.label)
      const link = nav.match(new RegExp(`<a [^>]*href="${i.href}"[^>]*>[\\s\\S]*?</a>`))?.[0] ?? ""
      assert.ok(link.includes(`title="${i.label}"`), `${i.label} hover/focus label`)
      assert.match(link, /<svg[^>]*aria-hidden="true"/)
    }
  }
  const docs = nav.match(/<a [^>]*href="http:\/\/localhost:3001"[^>]*>[\s\S]*?<\/a>/)?.[0] ?? ""
  assert.ok(docs, "Docs link points to the local Docusaurus server")
  assert.match(docs, /target="_blank"/)
  assert.match(docs, /rel="noopener noreferrer"/)
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

test("demo-only nav items stay hidden unless the server turns the demo on", () => {
  const demo = items.filter((i) => i.demoOnly)
  assert.deepEqual(demo.map((i) => i.href), ["/lab/safety-incidents"])
  const nav = (flag: boolean) => execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react");
    const { renderToStaticMarkup } = require("react-dom/server");
    const { LabShellView } = require("./components/lab/shell.tsx");
    globalThis.React = React;
    console.log(renderToStaticMarkup(React.createElement(LabShellView, { pathname: "/lab", userName: "x", mockLlm: true, showDemoPages: ${flag}, children: null })));
  `], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })
  assert.ok(!nav(false).includes(">Safety incidents<"))
  assert.ok(nav(true).includes(">Safety incidents<"))
})


test("header actions remain inside the shell header alongside existing controls", () => {
  const markup = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react"); globalThis.React = React;
    const { renderToStaticMarkup } = require("react-dom/server");
    const { LabShellView } = require("./components/lab/shell.tsx");
    console.log(renderToStaticMarkup(React.createElement(LabShellView, {
      pathname: "/lab", userName: "Reviewer", mockLlm: true,
      headerActions: React.createElement("button", {type: "button"}, "Support location"),
      children: React.createElement("p", null, "PAGE BODY"),
    })));
  `], {cwd: process.cwd(), encoding: "utf8", env: {...process.env, NODE_OPTIONS: ""}})
  const header = markup.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? ""
  assert.match(header, /Support location/)
  assert.match(header, /role="search"/)
  assert.match(header, /Teaching scaffold/)
  assert.match(markup, /aria-label="Lab"/)
  assert.match(markup, /PAGE BODY/)
})

test("header actions sit in the main header row, right before the theme toggle", () => {
  const markup = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const React = require("react"); globalThis.React = React;
    const { renderToStaticMarkup } = require("react-dom/server");
    const { LabShellView } = require("./components/lab/shell.tsx");
    console.log(renderToStaticMarkup(React.createElement(LabShellView, {
      pathname: "/lab", userName: "Reviewer", mockLlm: true,
      headerActions: React.createElement("button", {type: "button"}, "Support location"),
      children: null,
    })));
  `], {cwd: process.cwd(), encoding: "utf8", env: {...process.env, NODE_OPTIONS: ""}})
  const header = markup.match(/<header[^>]*>[\s\S]*?<\/header>/)?.[0] ?? ""
  const action = header.indexOf("Support location")
  const theme = header.indexOf('aria-label="Colour theme"')
  assert.ok(action > -1 && theme > -1)
  assert.ok(action < theme, "action should come before the theme toggle")
  assert.ok(header.indexOf('role="search"') < action, "action should come after the search form")
  assert.doesNotMatch(header, /justify-end px-4 pb-2/)
})
