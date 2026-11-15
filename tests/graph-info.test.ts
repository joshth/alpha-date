import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync, readFileSync, statSync } from "node:fs"
import { GRAPH_INFO, GRAPH_INFO_IDS } from "../lib/aura/graph-info"

const charts = readFileSync("components/aura/lifecycle-charts.tsx", "utf8")
const chartTitle = (id: string) => {
  if (id === "similarity") return "Similarity graph"
  if (id === "interest") return charts.match(/<ChartPanel title="([^"]+)"/)![1]
  return charts.match(new RegExp(`share\\("([^"]+)", ${id === "shares" ? "SHARE_SERIES" : "FEEDBACK_SERIES"}`))![1]
}
const norm = (s: string) => s.replace(/\s+/g, " ").trim()

test("ids in order", () => assert.deepEqual([...GRAPH_INFO_IDS], ["interest", "shares", "feedback", "similarity"]))

for (const id of GRAPH_INFO_IDS) {
  const g = GRAPH_INFO[id]
  test(`${id}: copy`, () => {
    assert.equal(g.id, id)
    assert.ok(g.title.length > 0)
    assert.equal(g.title, chartTitle(id))
    assert.ok(g.shows.length >= 40 && !/<[^>]+>/.test(g.shows))
    assert.ok(g.read.length >= 2 && g.read.length <= 5)
    for (const b of g.read) assert.ok(b.length >= 10, b)
    const all = [g.title, g.shows, ...g.read, g.transcript].join(" ")
    assert.doesNotMatch(all, /modern|sleek|seamless|elevate|cutting-edge/i)
  })
  test(`${id}: assets`, () => {
    assert.equal(g.video, `/explainers/${id}.mp4`)
    assert.equal(g.poster, `/explainers/${id}.jpg`)
    assert.equal(g.captions, `/explainers/${id}.vtt`)
    for (const p of [g.video, g.poster, g.captions]) assert.ok(existsSync("public" + p), p)
    assert.ok(statSync("public" + g.video).size < 3 * 1024 * 1024)
    assert.ok(readFileSync("public" + g.captions, "utf8").startsWith("WEBVTT"))
    assert.equal(g.transcript, norm(readFileSync(`public/explainers/${id}.txt`, "utf8")))
  })
}
