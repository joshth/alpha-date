"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AuraBadge } from "@/components/aura/aura-badge"
import {
  applyPreset,
  clearPreferences,
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  loadPreferences,
  resolvePreferences,
  savePreferences,
  shouldToggleHighContrast,
  updatePreference,
  type AccessibilityPreferences,
  type SystemPreferences,
} from "./preferences"

/** The accessibility icon from the project slides: white figure on a blue circle. */
function AccessibilityGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 820 820" className="size-12">
      <circle cx="410" cy="410" r="400" fill="#139fda" />
      <g fill="#fff">
        <circle cx="410" cy="223" r="46" />
        <path d="M222 287 L598 287 a20 20 0 0 1 0 38 L492 340 q-22 8 -22 30 L470 430 q0 40 8 80 L512 650 a20 20 0 0 1 -38 14 L424 505 q-14 -10 -28 0 L346 664 a20 20 0 0 1 -38 -14 L342 510 q8 -40 8 -80 L350 370 q0 -22 -22 -30 L222 325 a19 19 0 0 1 0 -38 Z" />
      </g>
    </svg>
  )
}

const skipLink = "sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-0 focus:left-0 focus:bg-background focus:text-foreground focus:p-3 focus:shadow-lg"
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function AccessibilityControls() {
  const [open, setOpen] = useState(false)
  const [preferences, setPreferences] = useState(DEFAULT_ACCESSIBILITY_PREFERENCES)
  const [system, setSystem] = useState<SystemPreferences>({ reducedMotion: false, highContrast: false, darkTheme: false })
  const [announcement, setAnnouncement] = useState("")
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  useEffect(() => {
    try {
      setPreferences(loadPreferences(window.localStorage))
    } catch {
      setPreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES })
    }
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const contrast = window.matchMedia("(prefers-contrast: more)")
    const theme = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystem = () => setSystem({ reducedMotion: motion.matches, highContrast: contrast.matches, darkTheme: theme.matches })
    updateSystem()
    motion.addEventListener("change", updateSystem)
    contrast.addEventListener("change", updateSystem)
    theme.addEventListener("change", updateSystem)
    return () => {
      motion.removeEventListener("change", updateSystem)
      contrast.removeEventListener("change", updateSystem)
      theme.removeEventListener("change", updateSystem)
    }
  }, [])

  useEffect(() => {
    const resolved = resolvePreferences(preferences, system)
    document.documentElement.dataset.highContrast = String(resolved.highContrast)
    document.documentElement.dataset.textSize = String(resolved.textSize)
    document.documentElement.dataset.colorVision = resolved.colorVision
    document.body.dataset.calmMotion = String(resolved.calmMotion)
    document.body.dataset.accessibilityFont = resolved.font
    document.body.dataset.lineSpacing = resolved.lineSpacing
    document.body.dataset.largeControls = String(resolved.largeControls)
  }, [preferences, system])

  const persist = useCallback((next: AccessibilityPreferences, message: string) => {
    setPreferences(next)
    let saved = false
    try {
      saved = savePreferences(window.localStorage, next)
    } catch {
      saved = false
    }
    setAnnouncement(saved ? message : `${message} This change applies for this visit but could not be saved.`)
  }, [])

  const setSetting = <K extends keyof Omit<AccessibilityPreferences, "preset">>(
    key: K,
    value: AccessibilityPreferences[K],
    description: string,
  ) => persist(updatePreference(preferences, key, value), `${description} changed. Preset: Custom.`)

  const selectPreset = (preset: "Vision" | "Motor" | "Reading") => {
    const next = applyPreset(preset)
    persist(next, `${preset} preset applied.`)
  }

  const reset = () => {
    try {
      clearPreferences(window.localStorage)
    } catch {
      // The defaults still apply for this visit when storage is blocked.
    }
    setPreferences({ ...DEFAULT_ACCESSIBILITY_PREFERENCES })
    setAnnouncement("Accessibility settings reset to defaults.")
  }

  const close = useCallback(() => {
    setOpen(false)
    requestAnimationFrame(() => returnFocusRef.current?.focus())
  }, [])

  const openSettings = (trigger: HTMLElement) => {
    returnFocusRef.current = trigger
    setOpen(true)
  }

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if (!shouldToggleHighContrast({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: event.target as HTMLElement | null,
      })) return
      event.preventDefault()
      const resolved = resolvePreferences(preferences, system)
      const nextValue = !resolved.highContrast
      persist(updatePreference(preferences, "highContrast", nextValue), `High contrast ${nextValue ? "on" : "off"}.`)
    }
    document.addEventListener("keydown", onShortcut)
    return () => document.removeEventListener("keydown", onShortcut)
  }, [preferences, system, persist])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        close()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, close])

  const resolved = resolvePreferences(preferences, system)
  const fontName = preferences.font === "system" ? "System default" : preferences.font === "atkinson" ? "Atkinson Hyperlegible" : "OpenDyslexic"

  return (
    <>
      <nav aria-label="Skip links">
        <a href="#lab-search" className={`${skipLink} ${focusRing}`}>
          Skip to search
        </a>
        <a
          href="#accessibility-options"
          aria-controls="accessibility-options"
          aria-expanded={open}
          onClick={(event) => openSettings(event.currentTarget)}
          className={`${skipLink} ${focusRing}`}
        >
          Accessibility options
        </a>
      </nav>
      <button
        type="button"
        aria-label="Accessibility options"
        aria-controls="accessibility-options"
        aria-expanded={open}
        onClick={(event) => openSettings(event.currentTarget)}
        className={`fixed right-4 top-24 z-40 flex size-12 items-center justify-center rounded-full shadow-md hover:brightness-110 ${focusRing}`}
      >
        <AccessibilityGlyph />
      </button>
      <section
        ref={panelRef}
        id="accessibility-options"
        aria-labelledby="accessibility-options-title"
        hidden={!open}
        tabIndex={-1}
        className="fixed right-4 top-24 z-50 max-h-[calc(100vh-7rem)] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-card p-5 text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="accessibility-options-title" className="text-lg font-semibold">Accessibility options</h2>
          <button type="button" onClick={close} className={`rounded px-3 py-2 text-sm ${focusRing}`}>
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Choose settings that make the Decoder easier to use.</p>
        <p className="mt-3 text-sm">Active preset: <strong>{preferences.preset}</strong></p>

        <fieldset className="mt-4">
          <legend className="text-sm font-semibold">Quick presets</legend>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {(["Vision", "Motor", "Reading"] as const).map((preset) => (
              <button key={preset} type="button" aria-pressed={preferences.preset === preset} onClick={() => selectPreset(preset)} className={`min-h-11 rounded border px-2 text-sm ${focusRing}`}>
                {preset}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="mt-5 grid gap-3">
          <legend className="text-sm font-semibold">Display settings</legend>
          <label className="grid gap-1 text-sm" htmlFor="accessibility-text-size">
            Text size
            <select id="accessibility-text-size" value={preferences.textSize} onChange={(event) => setSetting("textSize", Number(event.target.value) as AccessibilityPreferences["textSize"], "Text size")} className={`min-h-11 rounded border bg-background px-2 ${focusRing}`}>
              <option value="100">100% — Standard</option>
              <option value="125">125% — Large</option>
              <option value="150">150% — Larger</option>
              <option value="200">200% — Largest</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm" htmlFor="accessibility-line-spacing">
            Line spacing
            <select id="accessibility-line-spacing" value={preferences.lineSpacing} onChange={(event) => setSetting("lineSpacing", event.target.value as AccessibilityPreferences["lineSpacing"], "Line spacing")} className={`min-h-11 rounded border bg-background px-2 ${focusRing}`}>
              <option value="normal">Standard</option>
              <option value="relaxed">Relaxed</option>
              <option value="wide">Wide</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm" htmlFor="accessibility-font">
            Font
            <select id="accessibility-font" value={preferences.font} onChange={(event) => setSetting("font", event.target.value as AccessibilityPreferences["font"], "Font")} className={`min-h-11 rounded border bg-background px-2 ${focusRing}`}>
              <option value="system">System default</option>
              <option value="atkinson">Atkinson Hyperlegible</option>
              <option value="opendyslexic">OpenDyslexic</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm" htmlFor="accessibility-color-vision">
            Colour vision
            <select id="accessibility-color-vision" value={preferences.colorVision} onChange={(event) => setSetting("colorVision", event.target.value as AccessibilityPreferences["colorVision"], "Colour vision")} className={`min-h-11 rounded border bg-background px-2 ${focusRing}`}>
              <option value="standard">Standard palette</option>
              <option value="protanopia">Protanopia</option>
              <option value="deuteranopia">Deuteranopia</option>
              <option value="tritanopia">Tritanopia</option>
            </select>
          </label>
        </fieldset>

        <fieldset className="mt-5 grid gap-3">
          <legend className="text-sm font-semibold">More options</legend>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={resolved.calmMotion} onChange={(event) => setSetting("calmMotion", event.target.checked, "Calm motion")} className="h-5 w-5" />
            Calm motion
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" aria-keyshortcuts="Control+Shift+H Meta+Shift+H" checked={resolved.highContrast} onChange={(event) => setSetting("highContrast", event.target.checked, "High contrast")} className="h-5 w-5" />
            High contrast
          </label>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" checked={resolved.largeControls} onChange={(event) => setSetting("largeControls", event.target.checked, "Large controls")} className="h-5 w-5" />
            Larger controls
          </label>
          <p className="text-xs text-muted-foreground">Shortcut: Ctrl/⌘ + Shift + H toggles high contrast.</p>
        </fieldset>

        <section aria-labelledby="accessibility-preview-title" className="mt-5 rounded border p-3">
          <h3 id="accessibility-preview-title" className="text-sm font-semibold">Preview</h3>
          <article className="mt-2 rounded bg-background p-3">
            <h4 className="font-semibold">rizz</h4>
            <p className="mt-1 text-sm">Confidence, style or charm.</p>
            <div className="mt-2"><AuraBadge stage="peaking" confidence={0.83} /></div>
          </article>
          <p className="mt-2 text-xs text-muted-foreground">Font preview: {fontName}. The full preview follows your current settings.</p>
        </section>

        <button type="button" onClick={reset} className={`mt-5 min-h-11 rounded border px-3 text-sm ${focusRing}`}>Reset to defaults</button>
        <p role="status" aria-live="polite" className="sr-only">{announcement}</p>
      </section>
    </>
  )
}
