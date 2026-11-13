"use client"

import type React from "react"
import { usePathname } from "next/navigation"
import { LabShellView } from "./shell"

export function LabShell(props: { userName: string; mockLlm: boolean; children: React.ReactNode }) {
  return <LabShellView pathname={usePathname() ?? "/lab"} {...props} />
}
