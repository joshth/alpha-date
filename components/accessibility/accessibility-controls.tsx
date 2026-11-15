"use client"

import { useEffect, useRef, useState } from "react"

const skipLink = "sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-0 focus:left-0 focus:bg-background focus:text-foreground focus:p-3 focus:shadow-lg"
const focusRing = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function AccessibilityControls() {
  const [open, setOpen] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const panelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (open) panelRef.current?.focus()
  }, [open])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && open) {
        setOpen(false)
        requestAnimationFrame(() => linkRef.current?.focus())
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <>
      <nav aria-label="Skip links">
        <a href="#lab-search" className={`${skipLink} ${focusRing}`}>
          Skip to search
        </a>
        <a
          ref={linkRef}
          href="#accessibility-options"
          aria-controls="accessibility-options"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={`${skipLink} ${focusRing}`}
        >
          Accessibility options
        </a>
      </nav>
      <section
        ref={panelRef}
        id="accessibility-options"
        aria-labelledby="accessibility-options-title"
        hidden={!open}
        tabIndex={-1}
        className="fixed right-4 top-4 z-50 max-h-[90vh] w-[min(24rem,calc(100vw-2rem))] overflow-y-auto rounded-lg border bg-card p-5 text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="accessibility-options-title" className="text-lg font-semibold">Accessibility options</h2>
          <button type="button" onClick={() => {
            setOpen(false)
            requestAnimationFrame(() => linkRef.current?.focus())
          }} className={`rounded px-3 py-2 text-sm ${focusRing}`}>
            Close
          </button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">Choose settings that make the Decoder easier to use.</p>
      </section>
    </>
  )
}
