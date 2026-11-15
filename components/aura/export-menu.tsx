"use client"

import { useEffect, useId, useRef, useState } from "react"
import { csvBlobParts, csvFilename, toCsv, type ExportColumn, type ExportRow } from "@/lib/export/csv"
import { toXlsxBuffer, xlsxFilename } from "@/lib/export/xlsx"
import { pngFilename, svgToPng } from "@/lib/export/png"

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
// The trigger matches the "Show as table" button beside it; menu items are full-width rows.
const trigger = `inline-flex h-9 items-center gap-2 rounded border border-lab-border-strong px-3 text-sm text-lab-text hover:bg-lab-raised ${ring}`
const item = `flex h-9 w-full items-center gap-2 rounded px-3 text-sm text-lab-text hover:bg-lab-raised ${ring}`

export function ExportMenuView({ open, onToggle, onCsv, onXlsx, onPng, showPng, id }: {
  open: boolean
  onToggle: () => void
  onCsv: () => void
  onXlsx: () => void
  onPng: () => void
  showPng: boolean
  id: string
}) {
  return (
    <div className="relative inline-block">
      <button type="button" className={trigger} aria-haspopup="true" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M8 2v8M5 7l3 3 3-3M3 13h10" />
        </svg>
        Export
      </button>
      {open && (
        <div id={id} role="group" aria-label="Export format" className="absolute right-0 z-10 mt-1 w-44 rounded border border-lab-border bg-lab-surface p-1">
          <button type="button" className={item} onClick={onCsv}>CSV (.csv)</button>
          <button type="button" className={item} onClick={onXlsx}>Excel (.xlsx)</button>
          {showPng && <button type="button" className={item} onClick={onPng}>Image (.png)</button>}
        </div>
      )}
    </div>
  )
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportMenu({ filename, columns, rows, getSvg }: {
  filename: string
  columns: ExportColumn[]
  rows: ExportRow[]
  getSvg?: () => SVGSVGElement | null
}) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      close()
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onDown)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onDown)
    }
  }, [open])

  const now = () => new Date()
  // The menu unmounts when it closes, so put focus back on the Export button.
  const close = () => {
    setOpen(false)
    root.current?.querySelector("button")?.focus()
  }
  const onCsv = () => {
    download(new Blob(csvBlobParts(toCsv(columns, rows)), { type: "text/csv;charset=utf-8" }), csvFilename(filename, now()))
    close()
  }
  const onXlsx = async () => {
    close()
    const buf = await toXlsxBuffer(filename, columns, rows)
    download(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), xlsxFilename(filename, now()))
  }
  const onPng = async () => {
    close()
    const svg = getSvg?.()
    if (svg) download(await svgToPng(svg), pngFilename(filename, now()))
  }

  return (
    <div ref={root} className="inline-block">
      <ExportMenuView open={open} onToggle={() => setOpen((o) => !o)} onCsv={onCsv} onXlsx={onXlsx} onPng={onPng} showPng={!!getSvg} id={id} />
    </div>
  )
}
