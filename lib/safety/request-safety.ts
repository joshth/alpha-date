import "server-only"
import { checkInputSafety } from "@/lib/safety/gate"
import { createTrackedSafetyGate } from "@/lib/safety/events"
import { recordSafetyEvent } from "@/lib/safety/event-store"
import { isIncidentDemoEnabled } from "@/lib/safety/incident-demo"
import { recordDemoAlertResult, storeSafetyIncident } from "@/lib/safety/incident-store"
import { createIncidentSafetyCheck } from "@/lib/safety/incident-workflow"

export const checkRequestSafety = createIncidentSafetyCheck(
  createTrackedSafetyGate(checkInputSafety, recordSafetyEvent),
  {
    enabled: isIncidentDemoEnabled,
    save: storeSafetyIncident,
    notify: ({ referenceId, triageLevel }) => {
      if (process.env.SAFETY_DEMO_ALERT_FAILURE === "true") throw new Error("Simulated alert failure.")
      console.info("Simulated safety incident alert:", referenceId, triageLevel)
    },
    recordAlertResult: recordDemoAlertResult,
  },
)
