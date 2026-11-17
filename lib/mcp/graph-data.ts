import type { SirsFit } from "@/lib/aura/fit-command"

export interface AuraGraphData {
  term: string
  startWeek: string
  windowStart: string
  observed: number[]
  fitted: number[]
}

const round = (value: number) => Math.round(value * 1000) / 1000

/** The same 156 weeks the PNG shows, as numbers only, so a host that drops the image still lets the panel draw the chart. */
export function auraGraphData(fit: SirsFit): AuraGraphData {
  const weeks = fit.weeks.slice(-156)
  return {
    term: fit.term,
    startWeek: weeks[0],
    windowStart: fit.windowStart,
    observed: fit.counts.slice(-weeks.length).map(round),
    fitted: fit.fitted.I.slice(-weeks.length).map(round),
  }
}
