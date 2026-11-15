import type { AuraStage } from "./index"

export const MAX_NOTES = 24

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12)

export const SCALE: number[] = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84].map(hz)

export type Note = { freq: number; start: number; duration: number }

/** Turns the fitted I(t) curve into notes on a pentatonic scale (A11Y-06). */
export function trendNotes(I: number[], seconds = 3): Note[] {
  const max = Math.max(...I)
  if (!(max > 0)) return []
  const n = Math.min(I.length, MAX_NOTES)
  const duration = seconds / n
  return Array.from({ length: n }, (_, k) => {
    const v = Math.max(0, I[n === 1 ? 0 : Math.round((k * (I.length - 1)) / (n - 1))])
    return {
      freq: SCALE[Math.round((v / max) * (SCALE.length - 1))],
      start: k * duration,
      duration,
    }
  })
}

const CUES: Record<AuraStage, number[]> = {
  emerging: [60, 67],
  peaking: [60, 64, 67, 72],
  declining: [67, 60],
  parent_territory: [60, 66],
}

/** A short motif played after the curve so the stage is heard as well as the shape. */
export function stageCue(stage: AuraStage): number[] {
  return CUES[stage].map(hz)
}

export const CUE_NOTE_SECONDS = 0.25

/** Schedules the notes and the stage cue on a Web Audio context and returns a stop function. */
export function playTrend(ctx: AudioContext, notes: Note[], cue: number[], volume: number, onEnd?: () => void): () => void {
  if (!notes.length && !cue.length) {
    onEnd?.()
    return () => {}
  }
  const gain = ctx.createGain()
  gain.gain.value = volume
  gain.connect(ctx.destination)
  const t0 = ctx.currentTime
  const last = notes[notes.length - 1]
  const end = last ? last.start + last.duration : 0
  const all: Note[] = [
    ...notes,
    ...cue.map((freq, k) => ({ freq, start: end + k * CUE_NOTE_SECONDS, duration: CUE_NOTE_SECONDS })),
  ]
  const oscs = all.map((n) => {
    const osc = ctx.createOscillator()
    osc.frequency.value = n.freq
    osc.connect(gain)
    osc.start(t0 + n.start)
    osc.stop(t0 + n.start + n.duration)
    return osc
  })
  oscs[oscs.length - 1].onended = () => onEnd?.()
  return () => oscs.forEach((o) => o.stop())
}
