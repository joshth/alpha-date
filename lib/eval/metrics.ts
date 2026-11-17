// Shared metric helpers for the evaluation harness.
//
// Every rate keeps its numerator and denominator so a report can show "6 / 9"
// next to the percentage, and an empty denominator gives null (not 0 or NaN).
// The 95% interval is the Wilson score interval, which stays inside 0..1 and
// behaves sensibly on small samples like ours (9 invented words), unlike the
// plain p ± 1.96·sqrt(p(1-p)/n) interval.

export const Z_95 = 1.959963984540054

export interface Rate {
  numerator: number
  denominator: number
  value: number | null
  interval95: [number, number] | null
}

export function wilsonInterval(successes: number, trials: number, z = Z_95): [number, number] | null {
  if (trials === 0) return null
  const p = successes / trials
  const z2 = z * z
  const denominator = 1 + z2 / trials
  const centre = (p + z2 / (2 * trials)) / denominator
  const margin = (z * Math.sqrt((p * (1 - p)) / trials + z2 / (4 * trials * trials))) / denominator
  // At 0 / n and n / n the exact bound is 0 or 1; pin it so float rounding
  // can't report 0.9999999999999999.
  return [successes === 0 ? 0 : Math.max(0, centre - margin), successes === trials ? 1 : Math.min(1, centre + margin)]
}

export function rate(numerator: number, denominator: number): Rate {
  return {
    numerator,
    denominator,
    value: denominator === 0 ? null : numerator / denominator,
    interval95: wilsonInterval(numerator, denominator),
  }
}

export function formatRate(r: Rate): string {
  if (r.value === null || r.interval95 === null) return `n/a (${r.numerator} / ${r.denominator})`
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`
  return `${pct(r.value)} (${r.numerator} / ${r.denominator}; 95% CI ${pct(r.interval95[0])}–${pct(r.interval95[1])})`
}
