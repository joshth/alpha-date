import { resolveActivityPeriod, type ActivityPeriodKind } from "./activity-periods"

const shortDate = new Intl.DateTimeFormat("en-AU", {day: "numeric", month: "numeric", timeZone: "UTC"})
const fullDate = new Intl.DateTimeFormat("en-AU", {day: "numeric", month: "long", year: "numeric", timeZone: "UTC"})
const month = new Intl.DateTimeFormat("en-AU", {month: "long", year: "numeric", timeZone: "UTC"})

export function activityPeriodLabel(period: ActivityPeriodKind, date: string) {
  const {from, to} = resolveActivityPeriod(period, date, new Date(0))
  const start = new Date(from + "Z")
  const end = new Date(Date.parse(to + "Z") - 86400000)
  if (period === "week") return `${shortDate.format(start)} - ${shortDate.format(end)} (${start.getUTCFullYear() === end.getUTCFullYear() ? end.getUTCFullYear() : `${start.getUTCFullYear()} / ${end.getUTCFullYear()}`})`
  if (period === "month") return month.format(start)
  if (period === "year") return String(start.getUTCFullYear())
  return fullDate.format(start)
}

export function activityWeeks(year: number) {
  if (!Number.isInteger(year) || year < 2 || year > 9997) return []
  const first = new Date(`${String(year).padStart(4, "0")}-01-04T00:00:00Z`)
  first.setUTCDate(first.getUTCDate() - (first.getUTCDay() + 6) % 7)
  const weeks: {date: string; label: string}[] = []
  for (const day = new Date(first); ; day.setUTCDate(day.getUTCDate() + 7)) {
    const thursday = new Date(day)
    thursday.setUTCDate(day.getUTCDate() + 3)
    if (thursday.getUTCFullYear() !== year) break
    const date = day.toISOString().slice(0, 10)
    weeks.push({date, label: activityPeriodLabel("week", date)})
  }
  return weeks
}

export function activityWeekYear(date: string) {
  const day = new Date(date + "T00:00:00Z")
  day.setUTCDate(day.getUTCDate() + 3 - (day.getUTCDay() + 6) % 7)
  return day.getUTCFullYear()
}
