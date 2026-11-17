import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { shouldStartNavigationProgress } from "../components/lab/navigation-progress"

const click = (overrides: Partial<Parameters<typeof shouldStartNavigationProgress>[0]> = {}) => ({
  button: 0,
  defaultPrevented: false,
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: "_self",
  href: "/lab/aura",
  currentUrl: "http://localhost:3000/lab",
  ...overrides,
})

test("navigation progress starts for an in-app page link", () => {
  assert.equal(shouldStartNavigationProgress(click()), true)
})

test("navigation progress ignores clicks that do not navigate to another app page", () => {
  for (const input of [
    click({ href: "/lab" }),
    click({ href: "/lab#details" }),
    click({ href: "https://example.com/page" }),
    click({ target: "_blank" }),
    click({ button: 1 }),
    click({ metaKey: true }),
    click({ ctrlKey: true }),
    click({ shiftKey: true }),
    click({ altKey: true }),
    click({ defaultPrevented: true }),
  ]) assert.equal(shouldStartNavigationProgress(input), false, JSON.stringify(input))
})
