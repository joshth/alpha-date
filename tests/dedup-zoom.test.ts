import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import * as zoom from "@/lib/dedup/zoom"
const { fullView, panView, screenToGraph, zoomView } = zoom

const base = { width: 640, height: 400 }

test("zooming in 2x about the centre halves the view and keeps it centred", () => {
  assert.deepEqual(zoomView(fullView(base), base, 2, 320, 200), { x: 160, y: 100, w: 320, h: 200 })
})

test("zooming about a point keeps that point fixed on screen", () => {
  const v = zoomView(fullView(base), base, 2, 100, 50)
  assert.equal((100 - v.x) / v.w, 100 / 640)
  assert.equal((50 - v.y) / v.h, 50 / 400)
})

test("zoom out past the overview and in past 4x are clamped", () => {
  assert.deepEqual(zoomView(fullView(base), base, 0.5, 320, 200), { x: -80, y: -50, w: 800, h: 500 })
  assert.equal(zoomView(fullView(base), base, 100, 320, 200).w, 160)
})

test("zoomed view never leaves the graph bounds", () => {
  const v = zoomView(fullView(base), base, 4, 0, 0)
  assert.ok(v.x >= 0 && v.y >= 0 && v.x + v.w <= 640 && v.y + v.h <= 400)
})

test("panning moves the view by the given graph distance", () => {
  const zoomed = { x: 100, y: 100, w: 320, h: 200 }
  assert.deepEqual(panView(zoomed, base, 30, -20), { x: 130, y: 80, w: 320, h: 200 })
})

test("panning stops at the graph edges", () => {
  const zoomed = { x: 100, y: 100, w: 320, h: 200 }
  assert.deepEqual(panView(zoomed, base, 1000, 1000), { x: 320, y: 200, w: 320, h: 200 })
  assert.deepEqual(panView(zoomed, base, -1000, -1000), { x: 0, y: 0, w: 320, h: 200 })
})

test("screenToGraph maps a pixel in the svg box to graph coordinates of the current view", () => {
  const rect = { left: 10, top: 20, width: 320, height: 200 } // svg drawn at half size
  assert.deepEqual(screenToGraph(fullView(base), rect, 10, 20), { x: 0, y: 0 })
  assert.deepEqual(screenToGraph(fullView(base), rect, 170, 120), { x: 320, y: 200 })
  assert.deepEqual(screenToGraph({ x: 100, y: 100, w: 320, h: 200 }, rect, 170, 120), { x: 260, y: 200 })
})


test("overview opens with space around every node and can be dragged before zooming", () => {
  const opening = (zoom as typeof zoom & { overviewView: (size: typeof base) => zoom.View }).overviewView
  assert.equal(typeof opening, "function")
  assert.deepEqual(opening(base), { x: -80, y: -50, w: 800, h: 500 })
  assert.deepEqual(panView(opening(base), base, 40, -20), { x: -40, y: -70, w: 800, h: 500 })
  assert.deepEqual(zoomView(opening(base), base, 0.1, 320, 200), opening(base))
})
