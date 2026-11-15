"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { drawerFocusTarget } from "./drawer-focus"
import { applyThemePref, readThemePref, writeThemePref, type ThemePref } from "./theme"
import { LabShellView, shouldFocusSearch } from "./shell"

export function LabShell(props: { userName: string; mockLlm: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/lab"
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => setDrawerOpen(false), [pathname])
  // Light, Dark or System: read the saved choice once, apply it, and follow the OS while on System.
  const [themePref, setThemePref] = useState<ThemePref>("system")
  const storage = () => { try { return window.localStorage } catch { return null } }
  useEffect(() => setThemePref(readThemePref(storage())), [])
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)")
    const apply = () => applyThemePref(document.documentElement, themePref, mq.matches)
    apply()
    if (themePref !== "system") return
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [themePref])
  const onThemeChange = (pref: ThemePref) => {
    setThemePref(pref)
    writeThemePref(storage(), pref)
  }
  // Focus order: into the drawer when it opens, back to the menu button when it closes.
  const wasOpen = useRef(false)
  useEffect(() => {
    const target = drawerFocusTarget(wasOpen.current, drawerOpen)
    wasOpen.current = drawerOpen
    if (target === "sidebar") document.querySelector<HTMLElement>("#lab-sidebar a")?.focus()
    else if (target === "menu") document.querySelector<HTMLElement>('button[aria-controls="lab-sidebar"]')?.focus()
  }, [drawerOpen])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (shouldFocusSearch({ key: e.key, ctrlKey: e.ctrlKey, metaKey: e.metaKey, altKey: e.altKey, target: e.target as HTMLElement | null })) {
        e.preventDefault()
        document.getElementById("lab-search")?.focus()
      } else if (e.key === "Escape") setDrawerOpen(false)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])
  return (
    <LabShellView pathname={pathname} {...props} collapsed={collapsed} drawerOpen={drawerOpen}
      onToggleCollapsed={() => setCollapsed((c) => !c)} onToggleDrawer={() => setDrawerOpen((o) => !o)}
      themePref={themePref} onThemeChange={onThemeChange} />
  )
}
