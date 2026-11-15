import type React from "react"
import type { Metadata } from "next"
import "./globals.css"
import { Toaster } from "@/components/ui/toaster"

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
    <html lang="en-AU">
      <body className="font-sans antialiased">
        <nav aria-label="Skip links">
          <a
            href="#lab-search"
            className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-0 focus:left-0 focus:bg-background focus:text-foreground focus:p-3 focus:shadow-lg"
          >
            Skip to search
          </a>
          <a
            href="#accessibility-options"
            className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-0 focus:left-0 focus:bg-background focus:text-foreground focus:p-3 focus:shadow-lg"
          >
            Accessibility options
          </a>
        </nav>
        {children}
        <Toaster />
      </body>
    </html>
  )
}
