"use client"

import { useEffect } from "react"
import { animate, motion, useMotionValue, useTransform } from "motion/react"
import { Nunito } from "next/font/google"
import { Badge } from "@/components/ui/badge"

const nunito = Nunito({ subsets: ["latin"], weight: "900" })

export function AiCallsAvoidedBadge({ value }: { value: number }) {
  const count = useMotionValue(value)
  const rounded = useTransform(count, (latest) => Math.round(latest))

  useEffect(() => {
    const controls = animate(count, value, { duration: 0.6, ease: "easeOut" })
    return () => controls.stop()
  }, [value, count])

  return (
    <Badge variant="outline" className={`${nunito.className} gap-1 border-transparent bg-[#e5f8d0] uppercase tracking-wide text-[#58a700]`}>
      AI calls avoided <motion.span aria-hidden="true">{rounded}</motion.span>
      <span className="sr-only" aria-live="polite">
        {value} AI calls avoided
      </span>
    </Badge>
  )
}
