import { cookies } from "next/headers"
import { RegionProvider } from "@/components/safety/region-provider"
import { RegionSelector } from "@/components/safety/region-selector"
import { SUPPORT_REGION_COOKIE, supportRegion } from "@/lib/safety/regions"
import type React from "react"
import Link from "next/link"
import { getSessionUser } from "@/lib/_stubs/auth"
import { isMockLlm } from "@/lib/_stubs/llm"
import { isIncidentDemoEnabled } from "@/lib/safety/incident-demo"

export const metadata = { title: "Lexicon Lab" }

// Per-request data: never prerender at build time.
export const dynamic = "force-dynamic"

const NAV = [
  { href: "/lab", label: "Dashboard" },
  { href: "/lab/search", label: "Search" },
  { href: "/lab/eval", label: "Evaluation" },
  { href: "/lab/review", label: "Review queue" },
  { href: "/lab/safety-incidents", label: "Safety incidents", demoOnly: true },
  { href: "/lab/safety-activity", label: "Safety activity" },
]

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  const region = supportRegion((await cookies()).get(SUPPORT_REGION_COOKIE)?.value).code
  return (
    <RegionProvider initialRegion={region}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-2 px-4 py-3">
            <Link href="/lab" className="font-bold text-foreground">
              Gen Alpha Decoder · Lexicon Lab
            </Link>
            <div className="ml-auto"><RegionSelector /></div>
            <nav aria-label="Lab" className="w-full">
              <ul className="flex flex-wrap gap-1 text-sm">
                {NAV.filter(item => !item.demoOnly || isIncidentDemoEnabled()).map((item) => (
                  <li key={item.href}>
                    <Link href={item.href} className="rounded px-2 py-2 text-muted-foreground hover:text-primary">
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
          <p className="bg-muted px-4 py-1 text-center text-xs text-foreground">
            Teaching scaffold · signed in as mock user &quot;{user?.name}&quot; ·{" "}
            {isMockLlm() ? "mock AI and moderation" : "real AI and moderation (your own key)"}
          </p>
        </header>
        <main id="main-content" className="mx-auto max-w-4xl px-4 py-8">
          {children}
        </main>
        <footer className="mx-auto max-w-4xl px-4 pb-8 text-xs text-muted-foreground">
          Derived teaching scaffold of Gen Alpha Decoder™ — not the production service. Synthetic data only.
        </footer>
      </div>
    </RegionProvider>
  )
}
