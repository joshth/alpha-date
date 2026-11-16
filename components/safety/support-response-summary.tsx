import type { SafetyActivity } from "@/lib/safety/activity"

const categories = [
  ["suicide_self_harm", "Self-harm"],
  ["violence_threat", "Harm to others"],
  ["eating_disorder", "Eating disorders / body image"],
  ["sexual_exploitation", "Sexual exploitation"],
  ["bullying_harassment", "Bullying / harassment"],
  ["multiple", "Multiple concerns"],
  ["uncategorized", "No category recorded"],
] as const
const number = new Intl.NumberFormat("en-AU")
const percentage = new Intl.NumberFormat("en-AU", {style: "percent", maximumFractionDigits: 1})

export function SupportResponseSummary({ activity }: { activity: SafetyActivity }) {
  const safeguarding = activity.byOutcome.safeguarding
  const gentle = activity.byOutcome.gentle_support
  const total = safeguarding + gentle
  const rows = categories.map(([key, label]) => ({label, count: activity.supportCategories[key]}))
  const colours = ["#2563eb", "#d97706", "#7c3aed", "#be185d", "#0f766e", "#475569", "#64748b"]
  let cursor = 0
  const slices = rows.filter(row => row.count > 0).map(row => {
    const index = rows.indexOf(row)
    const start = cursor
    cursor += row.count / total * 100
    return `${colours[index]} ${start}% ${cursor}%`
  })
  const chartLabel = "Support response category counts. " + rows.map(row => `${row.label}: ${number.format(row.count)}`).join("; ")
  return (
    <section aria-labelledby="support-response-heading" className="space-y-4 rounded-xl border bg-card p-4 sm:p-6">
      <div>
        <h2 id="support-response-heading" className="text-xl font-semibold">Support responses issued</h2>
        <p className="mt-1 text-sm text-muted-foreground">Counts server outcome records for safeguarding and gentle support. These are not confirmed card views or unique people. Refusals and allowed lookups are excluded from this support total.</p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {[
          ["Combined support responses", total],
          ["Safeguarding responses", safeguarding],
          ["Gentle-support responses", gentle],
        ].map(([label, value], index) => (
          <div key={label} className={`rounded-lg border p-4 ${index === 0 ? "border-primary/40 bg-primary/10" : "bg-background"}`}>
            <dt className="text-sm text-muted-foreground">{label}</dt>
            <dd className="mt-2 text-3xl font-semibold tabular-nums">{number.format(Number(value))}</dd>
          </div>
        ))}
      </dl>
      {total === 0 && <p role="status">No recorded support responses in this period.</p>}
      <div>
        <h3 id="support-category-heading" className="font-semibold">Support response distribution</h3>
        <p id="support-category-help" className="mt-1 text-sm text-muted-foreground">Each support response counts once. Responses with several labels appear as “Multiple concerns”; unlabelled responses appear as “No category recorded”. Rounded percentages may differ slightly from 100%.</p>
      </div>
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <figure aria-labelledby="support-category-heading" aria-describedby="support-category-help">
          <div className="flex flex-wrap items-center justify-center gap-6">
            <div role="img" aria-label={chartLabel} className="h-52 w-52 shrink-0 rounded-full border border-border bg-muted" style={total === 0 ? undefined : {background: `conic-gradient(${slices.join(", ")})`}} />
            <ul className="space-y-2 text-sm">{rows.map((row, index) => (
              <li key={row.label} className="flex items-center gap-2"><span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-sm" style={{background: colours[index]}} /><span>{row.label}: <strong>{number.format(row.count)}</strong></span></li>
            ))}</ul>
          </div>
          <figcaption className="mt-3 text-xs text-muted-foreground">The table gives the same counts and percentages as the chart. No slices are drawn when the period has no recorded support responses.</figcaption>
        </figure>
        <table className="w-full text-left text-sm">
          <caption className="mb-2 text-left font-medium">Category counts and share of support responses</caption>
          <thead className="border-b"><tr><th scope="col" className="py-2">Category</th><th scope="col" className="px-2 py-2 text-right">Count</th><th scope="col" className="py-2 text-right">Share</th></tr></thead>
          <tbody>{rows.map(row => (
            <tr key={row.label} className="border-b last:border-0">
              <th scope="row" className="py-2 font-normal">{row.label}</th>
              <td className="px-2 py-2 text-right tabular-nums">{number.format(row.count)}</td>
              <td className="py-2 text-right tabular-nums">{total === 0 ? "Not available" : percentage.format(row.count / total)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </section>
  )
}
