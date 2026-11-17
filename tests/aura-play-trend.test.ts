import "./setup"
import { test } from "node:test"
import assert from "node:assert/strict"
import { playTrend, CUE_NOTE_SECONDS, type Note } from "../lib/aura/sonify"

type FakeOsc = { frequency: { value: number }; to: unknown; started: number[]; stopped: (number | undefined)[]; onended: (() => void) | null }

function fakeContext() {
  const oscs: FakeOsc[] = []
  const gains: { gain: { value: number; changes: [number, number, number][]; setTargetAtTime: (value: number, time: number, constant: number) => void }; to: unknown }[] = []
  const ctx = {
    currentTime: 10,
    destination: { name: "speakers" },
    createGain() {
      const g = { gain: { value: 1, changes: [] as [number, number, number][], setTargetAtTime(value: number, time: number, constant: number) { this.value = value; this.changes.push([value, time, constant]) } }, to: null as unknown, connect(node: unknown) { g.to = node } }
      gains.push(g)
      return g
    },
    createOscillator() {
      const o: FakeOsc & { connect(n: unknown): void; start(t: number): void; stop(t?: number): void } = {
        frequency: { value: 0 }, to: null, started: [], stopped: [], onended: null,
        connect(node) { o.to = node }, start(t) { o.started.push(t) }, stop(t) { o.stopped.push(t) },
      }
      oscs.push(o)
      return o
    },
  }
  return { ctx, oscs, gains }
}

const notes: Note[] = [
  { freq: 262, start: 0, duration: 0.5 },
  { freq: 330, start: 0.5, duration: 0.5 },
  { freq: 392, start: 1, duration: 0.5 },
]
const cue = [262, 370]
const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} !== ${b}`)

test("playTrend: one gain node at the chosen volume feeds the speakers", () => {
  const { ctx, oscs, gains } = fakeContext()
  playTrend(ctx as never, notes, cue, 0.3)
  assert.equal(gains.length, 1)
  assert.equal(gains[0].gain.value, 0.3)
  assert.equal(gains[0].to, ctx.destination)
  for (const o of oscs) assert.equal(o.to, gains[0])
})

test("playTrend: the active playback gain changes smoothly with the selected volume", () => {
  const { ctx, gains } = fakeContext()
  const playback = playTrend(ctx as never, notes, cue, 0.3) as unknown as { setVolume?: (volume: number) => void }
  assert.equal(typeof playback.setVolume, "function", "playback should expose a live volume control")
  playback.setVolume!(0.75)
  assert.deepEqual(gains[0].gain.changes, [[0.75, ctx.currentTime, 0.02]])
})

test("playTrend: each note is scheduled at its pitch and time from now", () => {
  const { ctx, oscs } = fakeContext()
  playTrend(ctx as never, notes, [], 1)
  assert.equal(oscs.length, notes.length)
  notes.forEach((n, i) => {
    assert.equal(oscs[i].frequency.value, n.freq)
    close(oscs[i].started[0], 10 + n.start)
    close(oscs[i].stopped[0] as number, 10 + n.start + n.duration)
  })
})

test("playTrend: the stage cue follows the last note, one cue note after another", () => {
  const { ctx, oscs } = fakeContext()
  playTrend(ctx as never, notes, cue, 1)
  assert.equal(oscs.length, notes.length + cue.length)
  cue.forEach((freq, k) => {
    const o = oscs[notes.length + k]
    assert.equal(o.frequency.value, freq)
    close(o.started[0], 10 + 1.5 + k * CUE_NOTE_SECONDS)
    close(o.stopped[0] as number, 10 + 1.5 + (k + 1) * CUE_NOTE_SECONDS)
  })
})

test("playTrend: the returned stop silences every note at once", () => {
  const { ctx, oscs } = fakeContext()
  const { stop } = playTrend(ctx as never, notes, cue, 1)
  ctx.currentTime = 10.2
  stop()
  for (const o of oscs) {
    const last = o.stopped[o.stopped.length - 1]
    assert.equal(o.stopped.length, 2)
    assert.ok(last === undefined || last <= 10.2)
  }
})

test("playTrend: onEnd runs when the last sound finishes", () => {
  const { ctx, oscs } = fakeContext()
  let ended = 0
  playTrend(ctx as never, notes, cue, 1, () => { ended++ })
  assert.equal(oscs.slice(0, -1).every((o) => o.onended === null), true)
  oscs[oscs.length - 1].onended?.()
  assert.equal(ended, 1)
})

test("playTrend: nothing to play makes no sound and ends at once", () => {
  const { ctx, oscs } = fakeContext()
  let ended = 0
  playTrend(ctx as never, [], [], 1, () => { ended++ })
  assert.equal(oscs.length, 0)
  assert.equal(ended, 1)
})
