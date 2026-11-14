import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { trendNotes, stageCue, SCALE, MAX_NOTES } from "../lib/aura/sonify"
import { AURA_STAGE_LABELS, type AuraStage } from "../lib/aura"

const rise = Array.from({ length: 100 }, (_, i) => i / 99)
const hump = Array.from({ length: 60 }, (_, i) => Math.sin((Math.PI * i) / 59))

test("trendNotes: nothing to play for an empty or flat-zero curve", () => {
  assert.deepEqual(trendNotes([]), [])
  assert.deepEqual(trendNotes([0, 0, 0]), [])
})

test("trendNotes: a long curve is cut to MAX_NOTES evenly spaced notes over 3 seconds", () => {
  const notes = trendNotes(rise)
  assert.equal(notes.length, MAX_NOTES)
  assert.equal(notes[0].start, 0)
  const last = notes[notes.length - 1]
  assert.ok(Math.abs(last.start + last.duration - 3) < 1e-9)
  for (let i = 1; i < notes.length; i++) assert.ok(notes[i].start > notes[i - 1].start)
})

test("trendNotes: a short curve keeps one note per point and fits the given length", () => {
  const notes = trendNotes([0.2, 0.4, 1], 1.5)
  assert.equal(notes.length, 3)
  assert.ok(Math.abs(notes[2].start + notes[2].duration - 1.5) < 1e-9)
})

test("trendNotes: every pitch is on the scale, and a higher I(t) is never a lower pitch", () => {
  const up = trendNotes(rise)
  for (const n of up) assert.ok(SCALE.includes(n.freq), `${n.freq} is not on the scale`)
  for (let i = 1; i < up.length; i++) assert.ok(up[i].freq >= up[i - 1].freq)
  assert.equal(up[0].freq, SCALE[0])
  assert.equal(up[up.length - 1].freq, SCALE[SCALE.length - 1])
})

test("trendNotes: a rise and fall is heard as pitch going up then down", () => {
  const freqs = trendNotes(hump).map((n) => n.freq)
  const top = freqs.indexOf(Math.max(...freqs))
  assert.ok(top > 0 && top < freqs.length - 1)
  assert.ok(freqs[0] < freqs[top] && freqs[freqs.length - 1] < freqs[top])
})

test("SCALE: ascending C major pentatonic over two octaves", () => {
  assert.equal(SCALE.length, 11)
  assert.ok(Math.abs(SCALE[0] - 261.63) < 0.01)
  assert.ok(Math.abs(SCALE[SCALE.length - 1] - 1046.5) < 0.01)
  for (let i = 1; i < SCALE.length; i++) assert.ok(SCALE[i] > SCALE[i - 1])
})

const stages = Object.keys(AURA_STAGE_LABELS) as AuraStage[]
const semitones = (a: number, b: number) => Math.round(12 * Math.log2(b / a))

test("stageCue: every stage has its own short cue", () => {
  const cues = stages.map((s) => stageCue(s))
  for (const cue of cues) assert.ok(cue.length >= 2 && cue.length <= 4)
  assert.equal(new Set(cues.map((c) => c.join(","))).size, stages.length)
})

test("stageCue: emerging rises, declining falls, peaking is a rising major chime", () => {
  const [e1, e2] = stageCue("emerging")
  assert.ok(e2 > e1)
  const [d1, d2] = stageCue("declining")
  assert.ok(d2 < d1)
  const chime = stageCue("peaking")
  assert.deepEqual(chime.slice(1).map((f, i) => semitones(chime[i], f)), [4, 3, 5])
})

test("stageCue: parent territory is a tritone, C then F sharp", () => {
  const [c, fSharp] = stageCue("parent_territory")
  assert.equal(stageCue("parent_territory").length, 2)
  assert.equal(c, SCALE[0])
  assert.equal(semitones(c, fSharp), 6)
})
