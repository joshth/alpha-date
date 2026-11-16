import { cookies } from "next/headers"
import { RegionProvider } from "@/components/safety/region-provider"
import { RegionSelector } from "@/components/safety/region-selector"
import { SUPPORT_REGION_COOKIE, supportRegion } from "@/lib/safety/regions"
import type React from "react"
import localFont from "next/font/local"
import { LabShell } from "@/components/lab/shell-client"
import { themeInitScript } from "@/components/lab/theme"
import { getSessionUser } from "@/lib/_stubs/auth"
import { isMockLlm } from "@/lib/_stubs/llm"
import { isIncidentDemoEnabled } from "@/lib/safety/incident-demo"

const plexSans = localFont({
  src: "../../fonts/IBMPlexSans-Variable.ttf",
  weight: "400 600",
  style: "normal",
  display: "swap",
  variable: "--font-plex-sans",
})
const plexMono = localFont({
  src: [
    { path: "../../fonts/IBMPlexMono-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../fonts/IBMPlexMono-Medium.ttf", weight: "500", style: "normal" },
    { path: "../../fonts/IBMPlexMono-SemiBold.ttf", weight: "600", style: "normal" },
  ],
  display: "swap",
  variable: "--font-plex-mono",
})

export const metadata = { title: "Lexicon Lab" }

// Per-request data: never prerender at build time.
export const dynamic = "force-dynamic"

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const region = supportRegion((await cookies()).get(SUPPORT_REGION_COOKIE)?.value).code
  return (
    <RegionProvider initialRegion={region}>
      <div className={`${plexSans.variable} ${plexMono.variable} lab min-h-screen bg-background font-sans text-foreground`}>
        {/* Sets the saved theme before first paint; the script contains no user input. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <LabShell userName={user?.name ?? "Mock user"} mockLlm={isMockLlm()} showDemoPages={isIncidentDemoEnabled()} headerActions={<RegionSelector />}>
          {children}
        </LabShell>
      </div>
    </RegionProvider>
  )
}
