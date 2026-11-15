"use client"
import { useEffect, useId, useRef, useState } from "react"
import type { AuraStage } from "@/lib/aura"
import { playTrend, stageCue, trendNotes } from "@/lib/aura/sonify"

export function TrendPlayer({ stage, series }: { stage: AuraStage | null; series: number[] }) {
  const [playing, setPlaying] = useState(false)
  const [volume, setVolume] = useState(0.5)
  const stop = useRef<(() => void) | null>(null)
  const id = useId()
  useEffect(() => () => stop.current?.(), [])
  if (!stage) return null
  const toggle = () => {
    if (playing) {
      stop.current?.()
      setPlaying(false)
      return
    }
    const ctx = new AudioContext()
    stop.current = playTrend(ctx, trendNotes(series), stageCue(stage), volume, () => { setPlaying(false); void ctx.close() })
    setPlaying(true)
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <button type="button" onClick={toggle}
        className="h-8 rounded-md border border-lab-border px-3 hover:bg-lab-raised focus-visible:outline focus-visible:outline-2">
        {playing ? "Stop" : "Play trend"}
      </button>
      <label htmlFor={id} className="text-lab-muted">Volume</label>
      <input id={id} type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(Number(e.target.value))} />
    </div>
  )
}
