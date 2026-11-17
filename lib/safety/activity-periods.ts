export const ACTIVITY_PERIODS = ["day", "week", "month", "year"] as const
export type ActivityPeriodKind = typeof ACTIVITY_PERIODS[number]
export interface ActivityPreset { period: ActivityPeriodKind; date: string }

export function resolveActivityPeriod(period: unknown, date: unknown, now: Date) {
  const kind = period === undefined ? "day" : period
  const selectedDate = date === undefined ? now.toISOString().slice(0, 10) : date
  if (!ACTIVITY_PERIODS.includes(kind as ActivityPeriodKind) || typeof selectedDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
    throw new Error("Choose a valid day, week, month or year and date.")
  }
  const from = new Date(selectedDate + "T00:00:00.000Z")
  if (!Number.isFinite(from.getTime()) || from.toISOString().slice(0, 10) !== selectedDate || from.getUTCFullYear() < 1 || from.getUTCFullYear() > 9998) {
    throw new Error("Choose a valid day, week, month or year and date.")
  }
  if (kind === "week") from.setUTCDate(from.getUTCDate() - (from.getUTCDay() + 6) % 7)
  if (kind === "month") from.setUTCDate(1)
  if (kind === "year") from.setUTCMonth(0, 1)
  const to = new Date(from)
  if (kind === "day") to.setUTCDate(to.getUTCDate() + 1)
  if (kind === "week") to.setUTCDate(to.getUTCDate() + 7)
  if (kind === "month") to.setUTCMonth(to.getUTCMonth() + 1)
  if (kind === "year") to.setUTCFullYear(to.getUTCFullYear() + 1)
  return {from: from.toISOString().slice(0, 19), to: to.toISOString().slice(0, 19), preset: {period: kind as ActivityPeriodKind, date: selectedDate}}
}
