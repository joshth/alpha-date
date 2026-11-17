import { FLOOR, R_PEAK, R_RISING_PEAK, type AuraStage } from "./index"

const WINDOW = 26
const BLOCK = 9
const SMOOTH = 4

export function fittedStages(values: number[]): (AuraStage | null)[] {
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - WINDOW + 1), i + 1)
    if (window.length < 3) return null
    const mean = (xs: number[]) => xs.reduce((sum, value) => sum + value, 0) / xs.length
    const first = mean(window.slice(0, Math.min(BLOCK, window.length)))
    const last = mean(window.slice(-Math.min(BLOCK, window.length)))
    let peak = 0
    for (let j = 0; j + SMOOTH <= window.length; j++) peak = Math.max(peak, mean(window.slice(j, j + SMOOTH)))
    if (peak <= 0) return "parent_territory"
    const r = last / peak
    const delta = (last - first) / peak
    if (delta >= FLOOR) return r >= R_RISING_PEAK ? "peaking" : "emerging"
    if (r >= R_PEAK) return "peaking"
    if (Math.abs(delta) < FLOOR) return "parent_territory"
    return "declining"
  })
}
