import "server-only"
import { redactPersonalInformation } from "@/lib/safety/privacy"
import type { checkInputSafety, RequestSafetyCheck } from "@/lib/safety/gate"
import { createSafetyIncident, type SafetyIncident } from "@/lib/safety/incidents"

type AlertResult = Extract<SafetyIncident["alertStatus"], "simulated" | "failed">
type DemoAlert = Pick<SafetyIncident, "referenceId" | "surface" | "crisis" | "triageLevel">

export function createIncidentSafetyCheck(
  check: typeof checkInputSafety,
  demo: {
    enabled: () => boolean
    save: (incident: SafetyIncident) => Promise<void>
    notify: (alert: DemoAlert) => void
    recordAlertResult: (reference: string, result: AlertResult) => Promise<void>
  },
): RequestSafetyCheck {
  return async (text, surface, originalText) => {
    const verdict = await check(text, surface, originalText)
    if (verdict.action !== "safeguarding" || !demo.enabled()) return verdict

    let incident: SafetyIncident
    try {
      // Local demo rules until the client supplies the institution's policy.
      const triageLevel = verdict.crisis
        ? "high"
        : verdict.decidedBy === "moderation" ? "moderation_only" : "medium"
      incident = createSafetyIncident({ query: redactPersonalInformation(originalText), surface, verdict, triageLevel })
      await demo.save(incident)
    } catch {
      return verdict
    }

    const { referenceId, crisis, triageLevel } = incident
    if (incident.alertStatus === "pending") {
      let result: AlertResult = "simulated"
      try {
        demo.notify({ referenceId, surface, crisis, triageLevel })
      } catch {
        result = "failed"
      }
      try {
        await demo.recordAlertResult(referenceId, result)
      } catch {
        // The incident is saved. Support still includes its reference.
      }
    }
    return { ...verdict, incidentReference: referenceId }
  }
}
