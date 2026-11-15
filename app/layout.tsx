import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"
import { AccessibilityControls } from "@/components/accessibility/accessibility-controls"
import { accessibilityInitScript } from "@/components/accessibility/preferences"

export const metadata: Metadata = {
  title: {
    default: "Lexicon Lab — Gen Alpha Decoder (Date scaffold)",
    template: "%s | Gen Alpha Decoder (Date scaffold)",
  },
  description: "Derived teaching scaffold of the Gen Alpha Decoder lexicon pipeline. Not the production site.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-AU" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <script dangerouslySetInnerHTML={{ __html: accessibilityInitScript() }} />
        <AccessibilityControls />
        {children}
        <Toaster />
      </body>
    </html>
  )
}
