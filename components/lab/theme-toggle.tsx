"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import type { ThemePref } from "./theme"

const OPTIONS = [
  { value: "light", label: "Light", Icon: Sun },
  { value: "dark", label: "Dark", Icon: Moon },
  { value: "system", label: "System", Icon: Monitor },
] as const

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

/** Light, Dark or System. System follows the operating system. The label is visible from the lg breakpoint up and read out below it. */
export function ThemeToggle({ pref, onChange }: { pref: ThemePref; onChange?: (pref: ThemePref) => void }) {
  return (
    <div role="group" aria-label="Colour theme" className="flex items-center rounded border border-lab-border-strong p-0.5">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          type="button"
          aria-pressed={pref === value}
          onClick={() => onChange?.(value)}
          className={`flex h-8 min-w-8 items-center justify-center gap-1.5 rounded px-2 text-xs ${ring} ${pref === value ? "bg-lab-raised text-lab-text" : "text-lab-muted hover:text-lab-text"}`}
        >
          <Icon aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only lg:not-sr-only">{label}</span>
        </button>
      ))}
    </div>
  )
}
