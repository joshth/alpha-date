import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { LAB_NAV } from "../components/lab/nav"

type Out = { keys: boolean[]; dflt: string; collapsed: string; drawer: string }
let cached: Out | undefined
const run = () => (cached ??= JSON.parse(execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const { LabShellView, shouldFocusSearch: f } = require("./components/lab/shell.tsx");
  globalThis.React = React;
  const view = (extra) => renderToStaticMarkup(React.createElement(LabShellView, {
    pathname: "/lab", userName: "Mock Reviewer", mockLlm: true, ...extra,
    children: React.createElement("p", null, "PAGE BODY"),
  }));
  const t = (tagName, isContentEditable) => ({ tagName, isContentEditable });
  console.log(JSON.stringify({
    keys: [
      f({ key: "/", target: t("BODY") }), f({ key: "/", target: t("INPUT") }),
      f({ key: "/", target: t("TEXTAREA") }), f({ key: "/", target: t("SELECT") }),
      f({ key: "/", target: t("DIV", true) }), f({ key: "/", ctrlKey: true, target: t("BODY") }),
      f({ key: "a", target: t("BODY") }), f({ key: "/", target: null }),
    ],
    dflt: view({}), collapsed: view({ collapsed: true }), drawer: view({ drawerOpen: true }),
  }));
`], { cwd: process.cwd(), encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } })))

const tag = (html: string, re: RegExp) => html.match(re)?.[0] ?? ""
const aside = (h: string) => tag(h, /<aside id="lab-sidebar"[^>]*>/)
const classes = (t: string) => (t.match(/class="([^"]*)"/)?.[1] ?? "").split(/\s+/)
const collapseBtn = (h: string) => tag(h, /<button[^>]*aria-expanded="[^"]*"[^>]*>(?:(?!<\/button>)[\s\S])*?(?:Collapse|Expand) sidebar/)
const menuBtn = (h: string) => tag(h, /<button[^>]*>(?:(?!<\/button>)[\s\S])*?Open menu/)

test("shouldFocusSearch: only bare '/' outside editable targets", () => {
  assert.deepEqual(run().keys, [true, false, false, false, false, false, false, true])
})

test("default: expanded rail, sidebar hidden below md, Open menu button", () => {
  const { dflt: h } = run()
  assert.match(collapseBtn(h), /aria-expanded="true"[\s\S]*Collapse sidebar/)
  assert.ok(classes(aside(h)).includes("hidden") && classes(aside(h)).includes("md:flex"))
  const m = menuBtn(h)
  assert.match(m, /aria-controls="lab-sidebar"/)
  assert.match(m, /aria-expanded="false"/)
  assert.ok(classes(m).includes("md:hidden"))
})

test("collapsed: narrow rail, labels kept as sr-only", () => {
  const { collapsed: h } = run()
  assert.match(collapseBtn(h), /aria-expanded="false"[\s\S]*Expand sidebar/)
  assert.ok(classes(aside(h)).includes("md:w-14"))
  const nav = tag(h, /<nav aria-label="Lab"[\s\S]*?<\/nav>/)
  for (const i of LAB_NAV.flatMap((g) => g.items)) {
    const link = tag(nav, new RegExp(`<a [^>]*href="${i.href}"[^>]*>[\\s\\S]*?</a>`))
    assert.ok(link.includes(`<span class="sr-only">${i.label}</span>`), i.label)
  }
})

test("drawerOpen: fixed (not hidden) sidebar, expanded menu button, backdrop", () => {
  const { drawer: h } = run()
  const c = classes(aside(h))
  assert.ok(c.includes("fixed") && !c.includes("hidden"), c.join(" "))
  assert.match(menuBtn(h), /aria-expanded="true"/)
  assert.match(h, /<[a-z]+ [^>]*data-drawer-backdrop/)
})
