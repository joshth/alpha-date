import { exportFilename } from "./csv"

export const pngFilename = (base: string, date: Date) => exportFilename(base, date, "png")

const VAR = /var\((--[\w-]+)\s*(?:,[^)]*)?\)/g

export const inlineCssVars = (svg: string, vars: Record<string, string>) =>
  svg.replace(VAR, (m, n: string) => vars[n] ?? m)

export const cssVarNames = (svg: string) => [...new Set([...svg.matchAll(VAR)].map((m) => m[1]))]

export function prepareSvgForExport(svg: string, size: { width: number; height: number }, background: string) {
  const clean = svg
    .replace(/<(foreignObject|script)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, "")
  return clean.replace(/<svg\b([^>]*)>/, (_, attrs: string) => {
    const a = attrs.replace(/\s(width|height)="[^"]*"/g, "")
    const add = (cond: boolean, s: string) => (cond ? "" : ` ${s}`)
    return `<svg${a}${add(/\sxmlns=/.test(a), 'xmlns="http://www.w3.org/2000/svg"')}${add(/xmlns:xlink=/.test(a), 'xmlns:xlink="http://www.w3.org/1999/xlink"')}${add(/\sviewBox=/.test(a), `viewBox="0 0 ${size.width} ${size.height}"`)}${add(/\sfont-family=/.test(a), 'font-family="IBM Plex Sans, Helvetica, Arial, sans-serif"')} width="${size.width}" height="${size.height}"><rect width="100%" height="100%" fill="${background}"/>`
  })
}

export async function svgToPng(svg: SVGSVGElement, opts: { scale?: number; background?: string } = {}): Promise<Blob> {
  const { width, height } = svg.getBoundingClientRect()
  const cs = getComputedStyle(document.querySelector(".lab") ?? document.documentElement)
  const raw = new XMLSerializer().serializeToString(svg)
  const vars = Object.fromEntries(cssVarNames(raw).map((n) => [n, cs.getPropertyValue(n).trim()]))
  const bg = opts.background ?? `hsl(${cs.getPropertyValue("--lab-surface").trim()})`
  const markup = prepareSvgForExport(inlineCssVars(raw, vars), { width, height }, bg)
  const img = new Image()
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
  await img.decode()
  const k = opts.scale ?? 2
  const canvas = document.createElement("canvas")
  canvas.width = width * k
  canvas.height = height * k
  const ctx = canvas.getContext("2d")!
  ctx.scale(k, k)
  ctx.drawImage(img, 0, 0, width, height)
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG export failed"))), "image/png"))
}
