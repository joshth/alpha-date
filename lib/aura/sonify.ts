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
