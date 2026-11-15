"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { drawerFocusTarget } from "./drawer-focus"
import { shouldStartNavigationProgress } from "./navigation-progress"
import { applyThemePref, readThemePref, writeThemePref, type ThemePref } from "./theme"
import { LabShellView, shouldFocusSearch } from "./shell"

export function LabShell(props: { userName: string; mockLlm: boolean; showDemoPages?: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/lab"
  const previousPathname = useRef(pathname)
  const [navigationProgress, setNavigationProgress] = useState<number | null>(null)
  const [navigationComplete, setNavigationComplete] = useState(false)
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const completionTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => setDrawerOpen(false), [pathname])
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null
      if (!target || !shouldStartNavigationProgress({
        button: event.button,
        defaultPrevented: event.defaultPrevented,
        metaKey: event.metaKey,
        ctrlKey: event.ctrlKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: target.getAttribute("target"),
        href: target.href,
        currentUrl: window.location.href,
      })) return

      if (progressInterval.current) clearInterval(progressInterval.current)
      if (progressTimeout.current) clearTimeout(progressTimeout.current)
      if (completionTimeout.current) clearTimeout(completionTimeout.current)
      setNavigationComplete(false)
      setNavigationProgress(12)
      progressInterval.current = setInterval(() => {
        setNavigationProgress((progress) => progress === null ? null : Math.min(90, progress + Math.max(1, (90 - progress) * 0.12)))
      }, 180)
      progressTimeout.current = setTimeout(() => {
        if (progressInterval.current) clearInterval(progressInterval.current)
        progressInterval.current = null
        setNavigationProgress(null)
      }, 15000)
    }

    // Capture before Next.js prevents the browser's default anchor navigation.
    document.addEventListener("click", onClick, true)
    return () => {
      document.removeEventListener("click", onClick, true)
      if (progressInterval.current) clearInterval(progressInterval.current)
      if (progressTimeout.current) clearTimeout(progressTimeout.current)
      if (completionTimeout.current) clearTimeout(completionTimeout.current)
    }
  }, [])
  useEffect(() => {
    if (previousPathname.current === pathname) return
    previousPathname.current = pathname
    if (navigationProgress === null) return
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (progressTimeout.current) clearTimeout(progressTimeout.current)
    progressInterval.current = null
    progressTimeout.current = null
    setNavigationProgress(100)
    setNavigationComplete(true)
    completionTimeout.current = setTimeout(() => {
      setNavigationProgress(null)
      setNavigationComplete(false)
      completionTimeout.current = null
    }, 180)
  }, [pathname, navigationProgress])
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
      navigationProgress={navigationProgress} navigationComplete={navigationComplete}
      onToggleCollapsed={() => setCollapsed((c) => !c)} onToggleDrawer={() => setDrawerOpen((o) => !o)}
      themePref={themePref} onThemeChange={onThemeChange} />
  )
}
