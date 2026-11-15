import { AURA_STAGE_LABELS, LOW_CONFIDENCE, type AuraStage } from "@/lib/aura"

const LOOK: Record<AuraStage, [string, string]> = {
  emerging: ["↗", "text-stage-emerging"],
  peaking: ["▲", "text-stage-peaking"],
  declining: ["↘", "text-stage-declining"],
  parent_territory: ["●", "text-stage-parent"],
}

export function AuraBadge({ stage, confidence }: { stage: AuraStage | null; confidence: number }) {
  const [shape, colour] = stage ? LOOK[stage] : ["○", "text-lab-muted"]
  const label = stage ? AURA_STAGE_LABELS[stage] : "No stage yet"
  const low = confidence < LOW_CONFIDENCE
  const level = confidence >= 0.7 ? "high" : low ? "low" : "medium"
  return (
    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-sm ${low ? "border-dashed border-lab-border-strong" : "border-lab-border"}`}>
      <span aria-hidden="true" className={colour}>{shape}</span>
      <span className="text-lab-text">{label}</span>
      {low && <span className="text-lab-muted">(low confidence)</span>}
      <span className="sr-only">{`${label}, ${level} confidence`}</span>
    </span>
  )
}
