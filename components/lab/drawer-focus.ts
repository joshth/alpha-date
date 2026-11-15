/** Where focus should go after the mobile drawer changes state: into it when it opens, back to its menu button when it closes. */
export function drawerFocusTarget(wasOpen: boolean, isOpen: boolean): "sidebar" | "menu" | null {
  if (!wasOpen && isOpen) return "sidebar"
  if (wasOpen && !isOpen) return "menu"
  return null
}
