export type NavigationClick = {
  button: number
  defaultPrevented: boolean
  metaKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  altKey: boolean
  target: string | null
  href: string
  currentUrl: string
}

export function shouldStartNavigationProgress(click: NavigationClick): boolean {
  if (click.button !== 0 || click.defaultPrevented) return false
  if (click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false
  if (click.target && click.target.toLowerCase() !== "_self") return false

  try {
    const destination = new URL(click.href, click.currentUrl)
    const current = new URL(click.currentUrl)
    return destination.origin === current.origin &&
      (destination.pathname !== current.pathname || destination.search !== current.search)
  } catch {
    return false
  }
}
