import { notFound } from "next/navigation"
import { getSessionUser, isReviewer } from "@/lib/_stubs/auth"
import { isIncidentDemoEnabled } from "@/lib/safety/incident-demo"
import { readRecentSafetyIncidentDetails } from "@/lib/safety/incident-store"

export const metadata = { title: "Safety incidents" }
export const dynamic = "force-dynamic"

const crisisLabel = { self_harm: "Self-harm", harm_to_others: "Harm to others" }
const triageLabel = { high: "High", medium: "Medium", moderation_only: "Moderation only" }
const alertLabel = { pending: "Pending", not_required: "Not required", simulated: "Simulated", failed: "Failed" }

export default async function SafetyIncidentsPage() {
  if (!isIncidentDemoEnabled()) notFound()
  const user = await getSessionUser()
  if (!user || !isReviewer(user)) notFound()
  const incidents = await readRecentSafetyIncidentDetails().catch(() => null)

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Safety incidents</h1>
      <p className="text-muted-foreground">Local demo for synthetic inputs. Submitted phrases are shown for incident review; alerts are simulated.</p>
      {incidents === null ? <p role="alert">Could not load incidents. Please try again.</p> : incidents.length === 0 ? (
        <p>No incidents recorded yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm [&_td]:p-3 [&_th]:p-3">
            <caption className="sr-only">Most recent 50 safety incidents</caption>
            <thead><tr>
              <th scope="col">Reference</th><th scope="col">Submitted phrase</th><th scope="col">Sydney time</th><th scope="col">Source</th>
              <th scope="col">Crisis</th><th scope="col">Triage</th><th scope="col">Status</th><th scope="col">Alert</th>
            </tr></thead>
            <tbody>{incidents.map(incident => (
              <tr key={incident.referenceId} className="border-t">
                <th scope="row"><code>{incident.referenceId}</code></th>
                <td className="min-w-48 max-w-sm whitespace-pre-wrap break-words">{incident.query}</td>
                <td><time dateTime={incident.recordedAtUtc.toISOString()}>{incident.recordedAtSydney.replace("T", " ")}</time></td>
                <td className="capitalize">{incident.surface}</td>
                <td>{incident.crisis ? crisisLabel[incident.crisis] : "No explicit crisis"}</td>
                <td>{triageLabel[incident.triageLevel]}</td>
                <td className="capitalize">{incident.status}</td>
                <td>{alertLabel[incident.alertStatus]}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
