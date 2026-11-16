import "server-only"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { readSafetyActivity, type SafetyActivity } from "@/lib/safety/activity"
import { readDiscoveryUsage, type DiscoveryUsage } from "@/lib/safety/discovery-usage"

export type ActivityParams = Record<string, string | string[] | undefined>
type PeriodFields = { from: string; to: string }
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

    const current = dependencies.now()
    const defaults = params.from === undefined && params.to === undefined
    const from = defaults ? new Date(current.getTime() - 86400000).toISOString().slice(0, 19) :
      typeof params.from === "string" ? params.from : ""
    const to = defaults ? new Date(current.getTime() + 1000).toISOString().slice(0, 19) : typeof params.to === "string" ? params.to : ""
    if (!localTimestamp.test(from) || !localTimestamp.test(to)) {
      return { status: "error", from, to, message: "Choose a start and end time in UTC." }
    }
    try {
      const activity = await dependencies.readSafetyActivity({ from: toUtc(from), to: toUtc(to) })
      if (!dependencies.readDiscoveryUsage) return { status: "ready", from, to, activity }
      const discovery = await dependencies.readDiscoveryUsage(activity.period).catch(() => null)
      return { status: "ready", from, to, activity, discovery }
    } catch {
      return { status: "error", from, to, message: "Could not load safety activity. Check the selected UTC period and try again." }
    }
  }
}

export const loadSafetyActivityView = createSafetyActivityView()
