import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { fullView, zoomView } from "@/lib/dedup/zoom"

const base = { width: 640, height: 400 }

test("zooming in 2x about the centre halves the view and keeps it centred", () => {
  assert.deepEqual(zoomView(fullView(base), base, 2, 320, 200), { x: 160, y: 100, w: 320, h: 200 })
})

test("zooming about a point keeps that point fixed on screen", () => {
  const v = zoomView(fullView(base), base, 2, 100, 50)
  assert.equal((100 - v.x) / v.w, 100 / 640)
  assert.equal((50 - v.y) / v.h, 50 / 400)
})

test("zoom out past the full graph and in past 4x are clamped", () => {
  assert.deepEqual(zoomView(fullView(base), base, 0.5, 320, 200), fullView(base))
  assert.equal(zoomView(fullView(base), base, 100, 320, 200).w, 160)
})

test("zoomed view never leaves the graph bounds", () => {
  const v = zoomView(fullView(base), base, 4, 0, 0)
  assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= 640 && v.y + v.h <= 400)
})
