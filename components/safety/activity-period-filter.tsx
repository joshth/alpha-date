"use client"

import { useState } from "react"
import { resolveActivityPeriod, type ActivityPreset } from "@/lib/safety/activity-periods"
import { activityPeriodLabel, activityWeeks, activityWeekYear } from "@/lib/safety/activity-period-labels"

const fieldClass = "max-w-full rounded-md border bg-background px-3 py-2"
const months = Array.from({length: 12}, (_, index) => new Intl.DateTimeFormat("en-AU", {month: "long", timeZone: "UTC"}).format(new Date(Date.UTC(2026, index, 1))))

export function ActivityPeriodFilter({from, to, preset}: {from: string; to: string; preset?: ActivityPreset}) {
  const initialDate = preset?.date ?? (/^\d{4}-\d{2}-\d{2}T/.test(from) ? from.slice(0, 10) : "")
  const [period, setPeriod] = useState(preset?.period ?? (from ? "custom" : "day"))
  const [date, setDate] = useState(initialDate)
  const [year, setYear] = useState(preset?.period === "week" ? String(activityWeekYear(initialDate)) : initialDate.slice(0, 4))
  const [customFrom, setCustomFrom] = useState(from)
  const [customTo, setCustomTo] = useState(to)
  const numericYear = Number(year)
  const validYear = /^\d{4}$/.test(year) && numericYear >= 2 && numericYear <= 9997
  const monthNumber = date.slice(5, 7) || "01"
  const weeks = activityWeeks(numericYear)
  let monday = ""
  try { monday = resolveActivityPeriod("week", date, new Date(0)).from.slice(0, 10) } catch { /* Incomplete dates have no selected week. */ }
  const weekDate = weeks.some(week => week.date === monday) ? monday : weeks[0]?.date ?? ""
  const selectedDate = period === "year" ? `${year}-01-01` : period === "month" ? `${year}-${monthNumber}-01` : period === "week" ? weekDate : date
  let preview = ""
  if (period !== "custom" && selectedDate && (period === "day" || validYear)) {
    try { preview = activityPeriodLabel(period as ActivityPreset["period"], selectedDate) } catch { /* Invalid fields remain editable. */ }
  }

  function changePeriod(value: string) {
    setPeriod(value)
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))) setYear(String(value === "week" ? activityWeekYear(date) : Number(date.slice(0, 4))))
  }

  return (
    <form action="/lab/safety-activity" method="get" aria-label="Activity period" className="space-y-3">
      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label htmlFor="activity-period" className="block text-sm font-medium">Period</label>
          <select id="activity-period" name="period" value={period} onChange={event => changePeriod(event.target.value)} className={fieldClass}>
            <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option><option value="custom">Custom UTC range</option>
          </select>
        </div>
        {period === "custom" ? <>
          <div className="space-y-1"><label htmlFor="activity-from" className="block text-sm font-medium">From (UTC)</label><input id="activity-from" name="from" type="datetime-local" step="1" required value={customFrom} onChange={event => setCustomFrom(event.target.value)} aria-describedby="period-help" className={fieldClass} /></div>
          <div className="space-y-1"><label htmlFor="activity-to" className="block text-sm font-medium">To (UTC, exclusive)</label><input id="activity-to" name="to" type="datetime-local" step="1" required value={customTo} onChange={event => setCustomTo(event.target.value)} aria-describedby="period-help" className={fieldClass} /></div>
        </> : <>
          {period === "day" ? <div className="space-y-1"><label htmlFor="activity-date" className="block text-sm font-medium">Day (UTC)</label><input id="activity-date" type="date" min="0002-01-01" max="9997-12-31" required value={date} onChange={event => setDate(event.target.value)} className={fieldClass} /></div> : <>
            <div className="space-y-1"><label htmlFor="activity-year" className="block text-sm font-medium">Year</label><input id="activity-year" type="number" min="2" max="9997" step="1" required value={year} onChange={event => setYear(event.target.value)} className={`${fieldClass} w-28`} /></div>
            {period === "month" && <div className="space-y-1"><label htmlFor="activity-month" className="block text-sm font-medium">Month (UTC)</label><select id="activity-month" value={monthNumber} onChange={event => setDate(`${year}-${event.target.value}-01`)} className={fieldClass}>{months.map((label, index) => <option key={label} value={String(index + 1).padStart(2, "0")}>{label}</option>)}</select></div>}
            {period === "week" && <div className="space-y-1"><label htmlFor="activity-week" className="block text-sm font-medium">Week (Monday - Sunday, UTC)</label><select id="activity-week" required value={weekDate} onChange={event => setDate(event.target.value)} className={fieldClass}>{weeks.map(week => <option key={week.date} value={week.date}>{week.label}</option>)}</select></div>}
          </>}
          <input type="hidden" name="date" value={selectedDate} />
        </>}
        <button type="submit" disabled={period !== "day" && period !== "custom" && !validYear} className="rounded-md bg-primary px-4 py-2 text-primary-foreground disabled:opacity-50">Show activity</button>
      </div>
      {preview && <p role="status" className="text-sm">Selected period (UTC): <strong>{preview}</strong></p>}
    </form>
  )
}
