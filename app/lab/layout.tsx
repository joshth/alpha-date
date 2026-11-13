import type React from "react"
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"
import { LabShell } from "@/components/lab/shell-client"
import { getSessionUser } from "@/lib/_stubs/auth"
import { isMockLlm } from "@/lib/_stubs/llm"

const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-plex-sans" })
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], display: "swap", variable: "--font-plex-mono" })

export const metadata = { title: "Lexicon Lab" }

// Per-request data: never prerender at build time.
export const dynamic = "force-dynamic"

export default async function LabLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser()
  return (
    <div className={`${plexSans.variable} ${plexMono.variable} lab min-h-screen bg-background font-sans text-foreground`}>
      <LabShell userName={user?.name ?? "Mock user"} mockLlm={isMockLlm()}>
        {children}
      </LabShell>
    </div>
  )
}
