export type View = { x: number; y: number; w: number; h: number }
type Size = { width: number; height: number }

export const MAX_ZOOM = 4

export const fullView = ({ width, height }: Size): View => ({ x: 0, y: 0, w: width, h: height })
export const overviewView = ({ width, height }: Size): View => ({ x: -width / 8, y: -height / 8, w: width * 1.25, h: height * 1.25 })

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** Keep the view inside the graph. */
export function clampView(view: View, base: Size): View {
  return view.w > base.width ? view : { ...view, x: clamp(view.x, 0, base.width - view.w), y: clamp(view.y, 0, base.height - view.h) }
}

/** Move the view by (dx, dy) in graph coordinates, stopping at the graph edges. */
export const panView = (view: View, base: Size, dx: number, dy: number): View => clampView({ ...view, x: view.x + dx, y: view.y + dy }, base)

/** Map a pointer position (px, py) over the drawn svg box to graph coordinates of the current view. */
export const screenToGraph = (view: View, rect: { left: number; top: number; width: number; height: number }, px: number, py: number) => ({
  x: view.x + ((px - rect.left) / rect.width) * view.w,
  y: view.y + ((py - rect.top) / rect.height) * view.h,
})

/** Zoom by `factor` about the point (cx, cy) in graph coordinates; the point stays fixed on screen. */
export function zoomView(view: View, base: Size, factor: number, cx: number, cy: number): View {
  const w = clamp(view.w / factor, base.width / MAX_ZOOM, base.width * 1.25)
  const k = w / view.w
  return clampView({ x: cx - (cx - view.x) * k, y: cy - (cy - view.y) * k, w, h: (base.height * w) / base.width }, base)
}
