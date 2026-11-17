"use client"

import { createContext, useContext, useState, type ReactNode } from "react"
import { DEFAULT_SUPPORT_REGION, isSupportRegion, SUPPORT_REGION_COOKIE, type SupportRegion } from "@/lib/safety/regions"

const RegionContext = createContext({
  region: DEFAULT_SUPPORT_REGION,
  setRegion: (_region: SupportRegion) => {},
})

export function RegionProvider({ initialRegion, children }: { initialRegion: SupportRegion; children: ReactNode }) {
  const [region, updateRegion] = useState<SupportRegion>(isSupportRegion(initialRegion) ? initialRegion : DEFAULT_SUPPORT_REGION)
  const setRegion = (value: SupportRegion) => {
    if (!isSupportRegion(value)) return
    updateRegion(value)
    try {
      document.cookie = `${SUPPORT_REGION_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`
    } catch {
      // Switching contacts still works if the browser blocks preference cookies.
    }
  }
  return <RegionContext.Provider value={{ region, setRegion }}>{children}</RegionContext.Provider>
}

export function useSupportRegion() {
  return useContext(RegionContext)
}
