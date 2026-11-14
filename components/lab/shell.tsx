import type React from "react"
import Link from "next/link"
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react"
import { LAB_NAV } from "./nav"

const ROOT = { href: "/lab", label: "Lexicon Lab" }
const items = LAB_NAV.flatMap((g) => g.items)

// Longest-prefix match; "/lab" (Dashboard) only matches exactly.
function activeHref(pathname: string) {
  return items
    .filter((i) => (i.href === "/lab" ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

export function breadcrumbs(pathname: string): { href: string; label: string }[] {
  const href = pathname === "/lab" ? undefined : activeHref(pathname)
  const item = items.find((i) => i.href === href)
  return item ? [ROOT, { href: item.href, label: item.label }] : [ROOT]
}

const ring = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export function shouldFocusSearch(e: {
  key: string; ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean
  target?: { tagName?: string; isContentEditable?: boolean } | null
}): boolean {
  if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return false
  const t = e.target
  return !(t && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName ?? "")))
}

export function LabShellView({ pathname, userName, mockLlm, children, collapsed = false, drawerOpen = false, onToggleCollapsed, onToggleDrawer }: {
  pathname: string
  userName: string
  mockLlm: boolean
  children: React.ReactNode
  collapsed?: boolean
  drawerOpen?: boolean
  onToggleCollapsed?: () => void
  onToggleDrawer?: () => void
}) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const active = activeHref(pathname)
  const crumbs = breadcrumbs(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-col border-b border-lab-border bg-lab-chrome">
       <div className="flex h-14 items-center gap-4 px-4">
        <button type="button" aria-controls="lab-sidebar" aria-expanded={drawerOpen} onClick={onToggleDrawer} className={`flex h-8 w-8 items-center justify-center rounded text-lab-muted hover:bg-lab-raised md:hidden ${ring}`}>
          <Menu aria-hidden="true" className="h-4 w-4" />
          <span className="sr-only">Open menu</span>
        </button>
        <Link href="/lab" className={`font-semibold ${ring}`}>Lexicon Lab</Link>
        <form role="search" action="/lab/search" className="relative mx-auto w-full max-w-md">
          <label htmlFor="lab-search" className="sr-only">Search or go to</label>
          <input id="lab-search" name="q" type="search" placeholder="Search or go to…" aria-keyshortcuts="/" className={`h-8 w-full rounded border border-lab-border-strong bg-lab-input px-3 text-sm text-lab-text placeholder:text-lab-muted ${ring}`} />
          <kbd aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-lab-muted">/</kbd>
        </form>
        <span title={userName} aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-lab-control text-xs font-medium">{initials}</span>
        <span className="sr-only">Signed in as {userName}</span>
       </div>
       <p className="bg-lab-raised px-4 py-1 text-xs text-lab-muted">
        Teaching scaffold · signed in as mock user &quot;{userName}&quot; ·{" "}
        {mockLlm ? "mock AI and moderation" : "real AI and moderation (your own key)"}
       </p>
      </header>
      <div className="flex flex-1">
        {drawerOpen && <div data-drawer-backdrop aria-hidden="true" onClick={onToggleDrawer} className="fixed inset-0 z-30 bg-lab-chrome/70 md:hidden" />}
        <aside id="lab-sidebar" className={`shrink-0 flex-col border-r border-lab-border bg-lab-chrome ${drawerOpen ? "fixed inset-y-0 left-0 z-40 flex w-60" : `hidden md:flex ${collapsed ? "md:w-14" : "w-60"}`}`}>
          <nav aria-label="Lab" className="flex-1 overflow-y-auto p-2">
            {LAB_NAV.map((group) => (
              <div key={group.label}>
                <h2 className={`${collapsed ? "sr-only" : ""} px-2 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-lab-muted`}>{group.label}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.href === active ? "page" : undefined}
                        className={`block rounded px-2 py-1.5 text-sm ${ring} ${item.href === active ? "bg-lab-raised text-lab-text" : "text-lab-muted hover:bg-lab-raised hover:text-lab-text"}`}
                      >{collapsed ? <><span className="sr-only">{item.label}</span><span aria-hidden="true">{item.label[0]}</span></> : item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <button type="button" aria-expanded={!collapsed} aria-controls="lab-sidebar" onClick={onToggleCollapsed} className={`m-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm text-lab-muted hover:bg-lab-raised hover:text-lab-text ${ring}`}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}
            {collapsed ? <span className="sr-only">Expand sidebar</span> : "Collapse sidebar"}
          </button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <nav aria-label="Breadcrumb" className="px-6 pt-4 text-sm text-lab-muted">
            <ol className="flex gap-2">
              {crumbs.map((c, i) => (
                <li key={c.href} className="flex gap-2">
                  {i > 0 && <span aria-hidden="true">/</span>}
                  {i < crumbs.length - 1 ? <Link href={c.href} className={ring}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                </li>
              ))}
            </ol>
          </nav>
          <main id="main-content" className="flex-1 px-6 py-6">{children}</main>
          <footer className="px-6 pb-6 text-xs text-lab-muted">
            Derived teaching scaffold of Gen Alpha Decoder™ — not the production service. Synthetic data only.
          </footer>
        </div>
      </div>
    </div>
  )
}
