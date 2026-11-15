import type { SafetyActivityView } from "@/lib/safety/activity-view"

const labels = { safe: "Allowed", refuse: "Refused", safeguarding: "Safeguarding", gentle_support: "Gentle support" } as const
const number = new Intl.NumberFormat("en-AU")
const usd = new Intl.NumberFormat("en-AU", { style: "currency", currency: "USD", maximumFractionDigits: 6 })
const percentage = new Intl.NumberFormat("en-AU", { style: "percent", maximumFractionDigits: 1 })

export function SafetyActivitySummary({ view }: { view: SafetyActivityView }) {
  return (
    <section aria-labelledby="activity-heading" className="space-y-6">
      <div>
        <h1 id="activity-heading" className="text-2xl font-bold">Safety activity</h1>
        <p className="text-muted-foreground">Recorded safety outcomes for searches and suggestions.</p>
      </div>
      {view.status === "forbidden" ? <p role="alert">Reviewer access required.</p> : (
        <>
          <form action="/lab/safety-activity" method="get" className="flex flex-wrap items-end gap-4">
            <div className="space-y-1">
              <label htmlFor="activity-from" className="block text-sm font-medium">From (UTC)</label>
              <input id="activity-from" name="from" type="datetime-local" step="1" required defaultValue={view.from}
                aria-describedby="period-help" className="rounded-md border bg-background px-3 py-2" />
            </div>
            <div className="space-y-1">
              <label htmlFor="activity-to" className="block text-sm font-medium">To (UTC, exclusive)</label>
              <input id="activity-to" name="to" type="datetime-local" step="1" required defaultValue={view.to}
                aria-describedby="period-help" className="rounded-md border bg-background px-3 py-2" />
            </div>
            <button type="submit" className="rounded-md bg-primary px-4 py-2 text-primary-foreground">Show activity</button>
          </form>
          <p id="period-help" className="text-sm text-muted-foreground">Times are in UTC. The start is included and the end is excluded. The default period is the last 24 hours.</p>
          {view.status === "error" ? <p role="alert">{view.message}</p> : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                {[
                  ["Recorded evaluations", number.format(view.activity.evaluated)],
                  ["Allowed by gate", number.format(view.activity.allowed)],
                  ["Stopped by gate", number.format(view.activity.blocked)],
                  ["Stopped rate", view.activity.blockedRate === null ? "Not available" : percentage.format(view.activity.blockedRate)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border p-4">
                    <dt className="text-sm text-muted-foreground">{label}</dt>
                    <dd className="mt-2 text-2xl font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              {view.activity.evaluated === 0 && <p role="status">No recorded outcomes in this period.</p>}
              <table className="w-full text-left text-sm">
                <caption className="mb-2 text-left font-semibold">Recorded safety outcomes</caption>
                <thead className="border-b"><tr><th scope="col" className="py-2">Outcome</th><th scope="col" className="py-2 text-right">Count</th></tr></thead>
                <tbody>
                  {(Object.keys(labels) as (keyof typeof labels)[]).map(outcome => (
                    <tr key={outcome} className="border-b last:border-0">
                      <th scope="row" className="py-2 font-normal">{labels[outcome]}</th>
                      <td className="py-2 text-right">{number.format(view.activity.byOutcome[outcome])}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-sm text-muted-foreground">Stopped outcomes include refusals, safeguarding and gentle support. Allowed outcomes mean the gate permitted continuation, not that a search succeeded.</p>
              {view.discovery !== undefined && (
                <section aria-labelledby="discovery-usage-heading" className="space-y-3 rounded-lg border p-4">
                  <h2 id="discovery-usage-heading" className="font-semibold">Discovery usage in this period</h2>
                  {view.discovery === null ? <p role="status">Could not load discovery usage.</p> : (
                    <>
                      <dl className="grid gap-3 sm:grid-cols-2">
                        <div><dt>Recorded discovery calls avoided</dt><dd className="font-semibold">{number.format(view.discovery.callsAvoided)}</dd></div>
                        <div><dt>Estimated savings (USD)</dt><dd className="font-semibold">{view.discovery.estimate ? usd.format(view.discovery.estimate.savingsUsd) : "Average cost unavailable"}</dd></div>
                      </dl>
                      {view.discovery.estimate && <p className="text-sm text-muted-foreground">Estimate uses {usd.format(view.discovery.estimate.averageCostUsd)} per call. Recorded events can include demo traffic.</p>}
                      <p className="text-sm text-muted-foreground">A recorded lexicon match skipped discovery. Safety stops are counted separately because their effect on model calls is unknown.</p>
                    </>
                  )}
                </section>
              )}
            </>
          )}
          <p className="text-sm text-muted-foreground">Safety outcome totals can miss events or change as delayed events arrive. They do not measure unique users, model calls avoided or cost savings.</p>
        </>
      )}
    </section>
  )
}
