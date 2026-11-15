import { sql } from "drizzle-orm"
import type { AnyPgColumn } from "drizzle-orm/pg-core"

export function reviewCreatedAt(column: AnyPgColumn) {
  // Legacy columns store database-local wall time without a timezone.
  return sql<Date>`${column} AT TIME ZONE current_setting('TimeZone')`.mapWith(value => new Date(value))
}

const sydneyTime = new Intl.DateTimeFormat("en-AU", {
  timeZone: "Australia/Sydney", day: "2-digit", month: "2-digit", year: "numeric",
  hour: "numeric", minute: "2-digit", second: "2-digit", timeZoneName: "short",
})

export function formatReviewTime(value: string): string {
  return sydneyTime.format(new Date(value))
}
