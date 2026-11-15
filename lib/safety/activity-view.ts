import { resolveActivityPeriod, type ActivityPreset } from "@/lib/safety/activity-periods"
import "server-only"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { readSafetyActivity, type SafetyActivity } from "@/lib/safety/activity"
import { readDiscoveryUsage, type DiscoveryUsage } from "@/lib/safety/discovery-usage"

export type ActivityParams = Record<string, string | string[] | undefined>
type PeriodFields = { from: string; to: string; preset?: ActivityPreset }
export type SafetyActivityView =
  | { status: "forbidden" }
  | ({ status: "ready"; activity: SafetyActivity; discovery?: DiscoveryUsage | null } & PeriodFields)
  | ({ status: "error"; message: string } & PeriodFields)

const localTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/
const toUtc = (value: string) => value + (value.length === 16 ? ":00Z" : "Z")

export function createSafetyActivityView(dependencies: {
  getSessionUser: typeof getSessionUser
  isReviewer: typeof isReviewer
  readSafetyActivity: typeof readSafetyActivity
  readDiscoveryUsage?: typeof readDiscoveryUsage
  now: () => Date
} = { getSessionUser, isReviewer, readSafetyActivity, readDiscoveryUsage, now: () => new Date() }) {
  return async (params: ActivityParams): Promise<SafetyActivityView> => {
    const user = await dependencies.getSessionUser()
    if (!user || !dependencies.isReviewer(user)) return { status: "forbidden" }

    const custom = params.period === "custom" || (params.period === undefined && (params.from !== undefined || params.to !== undefined))
    let fields: PeriodFields
    try {
      fields = custom ? {
        from: typeof params.from === "string" ? params.from : "",
        to: typeof params.to === "string" ? params.to : "",
      } : resolveActivityPeriod(params.period, params.date, dependencies.now())
    } catch {
      return {status: "error", from: "", to: "", message: "Choose a valid day, week, month or year and date."}
    }
    const {from, to} = fields
    if (!localTimestamp.test(from) || !localTimestamp.test(to)) {
      return { status: "error", ...fields, message: "Choose a start and end time in UTC." }
    }
    try {
      const activity = await dependencies.readSafetyActivity({ from: toUtc(from), to: toUtc(to) })
      if (!dependencies.readDiscoveryUsage) return { status: "ready", ...fields, activity }
      const discovery = await dependencies.readDiscoveryUsage(activity.period).catch(() => null)
      return { status: "ready", ...fields, activity, discovery }
    } catch {
      return { status: "error", ...fields, message: "Could not load safety activity. Check the selected UTC period and try again." }
    }
  }
}

export const loadSafetyActivityView = createSafetyActivityView()
