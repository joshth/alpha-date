"use client"

import { useEffect, useRef, useState } from "react"
import { animate } from "motion/react"
import localFont from "next/font/local"
import { Badge } from "@/components/ui/badge"

const nunito = localFont({ src: "../../fonts/Nunito-Variable.ttf", weight: "900", display: "swap" })

export function AiCallsAvoidedBadge({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(value)
  const previous = useRef(value)

  useEffect(() => {
    const controls = animate(previous.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplayed(Math.round(latest)),
    })
    previous.current = value
    return () => controls.stop()
  }, [value])

  return (
    <Badge variant="outline" className={`${nunito.className} gap-1 border-transparent bg-[#e5f8d0] uppercase tracking-wide text-[#58a700]`}>
      AI calls avoided <span aria-hidden="true">{displayed}</span>
      <span className="sr-only" aria-live="polite">
        {value} AI calls avoided
      </span>
    </Badge>
  )
}
