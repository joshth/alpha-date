import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { drawerFocusTarget } from "../components/lab/drawer-focus"

// WCAG 2.4.3 Focus Order: opening the drawer moves focus into it, closing it puts focus back on the menu button.
test("drawerFocusTarget: into the sidebar when it opens, back to the menu button when it closes", () => {
  assert.equal(drawerFocusTarget(false, true), "sidebar")
  assert.equal(drawerFocusTarget(true, false), "menu")
})

test("drawerFocusTarget: no focus move when nothing changed (first render, or still open or closed)", () => {
  assert.equal(drawerFocusTarget(false, false), null)
  assert.equal(drawerFocusTarget(true, true), null)
})

test("the shell uses it to focus the first sidebar link or the menu button", () => {
  const src = readFileSync("components/lab/shell-client.tsx", "utf8")
  assert.match(src, /drawerFocusTarget/)
  assert.match(src, /#lab-sidebar a/)
  assert.match(src, /aria-controls="lab-sidebar"/)
})
