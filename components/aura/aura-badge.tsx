"use client"

import { useEffect, useRef, useState } from "react"
import { AURA_STAGE_LABELS, LOW_CONFIDENCE, type AuraStage } from "@/lib/aura"

const STAGE_ORDER: (AuraStage | null)[] = ["emerging", "peaking", "declining", "parent_territory", null]
const LOOK: Record<AuraStage | "none", [string, string, string]> = {
  emerging: ["text-stage-emerging", "M5 19 19 5M19 5H8M19 5v11", "emerging"],
  peaking: ["text-stage-peaking", "M5 19 12 5l7 14H5Z", "peaking"],
  declining: ["text-stage-declining", "M5 5l14 14m0-11v11H8", "declining"],
  parent_territory: ["text-stage-parent", "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Z", "parent_territory"],
  none: ["text-lab-muted", "M6 6l12 12m0-12L6 18", "none"],
}

const MEANINGS: Record<AuraStage | "none", string> = {
  emerging: "Rising fast. Kids are starting to use it.",
  peaking: "Close to its all-time high. Everyone is using it.",
  declining: "Falling clearly from its peak.",
  parent_territory: "Past its peak and flat. It is no longer cool.",
  none: "There is not enough history to assign a stage.",
}

function AuraIcon({ stage }: { stage: AuraStage | null }) {
  const [colour, path, name] = LOOK[stage ?? "none"]
  return <svg aria-hidden="true" data-aura-icon={name} className={`size-4 shrink-0 ${colour}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={path} /></svg>
}

export function AuraGlossary({ open: controlledOpen }: { open?: boolean } = {}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open) dialogRef.current?.focus()
    else triggerRef.current?.focus()
  }, [open])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && controlledOpen === undefined) setUncontrolledOpen(false)
    }
    document.addEventListener("keydown", close)
    return () => document.removeEventListener("keydown", close)
  }, [controlledOpen])
  return <>
    <button ref={triggerRef} type="button" aria-expanded={open} onClick={() => setUncontrolledOpen((o) => !o)} className="rounded px-1 text-sm underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">What does this mean?</button>
    {open && <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="aura-glossary-title" tabIndex={-1} className="mt-2 rounded border border-lab-border bg-lab-surface-raised p-3">
      <h2 id="aura-glossary-title" className="font-semibold">Aura stages</h2>
      <ul className="mt-2 grid gap-2">{STAGE_ORDER.map((stage) => <li key={stage ?? "none"} className="flex items-start gap-2"><AuraIcon stage={stage} /><span><strong>{stage ? AURA_STAGE_LABELS[stage] : "No stage yet"}</strong>: {MEANINGS[stage ?? "none"]}</span></li>)}</ul>
    </div>}
  </>
}

export function AuraBadge({ stage, confidence, glossary = true }: { stage: AuraStage | null; confidence: number; glossary?: boolean }) {
  const label = stage ? AURA_STAGE_LABELS[stage] : "No stage yet"
  const low = confidence < LOW_CONFIDENCE
  const level = confidence >= 0.7 ? "high" : low ? "low" : "medium"
  return (
    <span aria-label={`Aura: ${label}, ${level} confidence`} className={`inline-flex flex-wrap items-center gap-1.5 rounded border px-2 py-0.5 text-sm ${low ? "border-dashed border-lab-border-strong" : "border-lab-border"}`}>
      <AuraIcon stage={stage} />
      <span className="text-lab-text">{label}</span>
      {low && <span className="text-lab-muted">(low confidence)</span>}
      <span className="sr-only">{`${label}, ${level} confidence`}</span>
      {glossary && <AuraGlossary />}
    </span>
  )
}
