import type { SirsFit } from "./fit-command"

export const VIEW_WEEKS = 156

/** The one sentence every Aura chart summary shares (A11Y-05). */
export function trendSentence({ r, delta, stage }: Pick<SirsFit, "r" | "delta" | "stage">): string {
  if (stage === null) return "No stage yet: the curve hasn't taken off."
  const pts = Math.round(delta * 100)
  const from = r >= 0.995 ? "At its peak" : `Down ${Math.round((1 - r) * 100)}% from its peak`
  return `${from}, ${pts === 0 ? "no change" : `${pts > 0 ? "up" : "down"} ${Math.abs(pts)} ${Math.abs(pts) === 1 ? "point" : "points"}`} in the last 180 days.`
}

export function lifecycleRows(fit: SirsFit) {
  const start = Math.max(0, fit.weeks.length - VIEW_WEEKS)
  return fit.weeks.slice(start).map((week, k) => {
    const i = start + k
    const { S, R, I, Gamma } = { S: fit.fitted.S[i], R: fit.fitted.R[i], I: fit.fitted.I[i], Gamma: fit.fitted.Gamma[i] }
    return {
      week, interest: fit.counts[i], fitted: I, susceptible: S, infected: 1 - S - R, recovered: R, feedback: Gamma,
      inWindow: week >= fit.windowStart && week <= fit.now,
    }
  })
}

/** The 180-day window as two plotted weeks. A band on a weekly category axis only draws when both ends are real weeks. */
export function windowBounds(weeks: string[], windowStart: string, now: string): { from: string; to: string } | null {
  const from = weeks.find((w) => w >= windowStart)
  const to = [...weeks].reverse().find((w) => w <= now)
  return from && to && from <= to ? { from, to } : null
}
