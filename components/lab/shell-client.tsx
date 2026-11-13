"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { LabShellView, shouldFocusSearch } from "./shell"

export function LabShell(props: { userName: string; mockLlm: boolean; children: React.ReactNode }) {
  const pathname = usePathname() ?? "/lab"
  const [collapsed, setCollapsed] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  useEffect(() => setDrawerOpen(false), [pathname])
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
      onToggleCollapsed={() => setCollapsed((c) => !c)} onToggleDrawer={() => setDrawerOpen((o) => !o)} />
  )
}
