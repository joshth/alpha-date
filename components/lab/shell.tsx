import type React from "react"
import Link from "next/link"
import { Activity, ArrowLeft, BarChart3, BookOpen, ClipboardCheck, Database, FileBarChart, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, Search, ShieldAlert, type LucideIcon } from "lucide-react"
import { LAB_NAV } from "./nav"
import { ThemeToggle } from "./theme-toggle"
import type { ThemePref } from "./theme"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const ROOT = { href: "/lab", label: "Lexicon Lab" }
const items = LAB_NAV.flatMap((g) => g.items)
const icons: Record<string, LucideIcon> = {
  Dashboard: LayoutDashboard, Search, "Review queue": ClipboardCheck,
  Evaluation: BarChart3, "Model reports": FileBarChart, "Safety activity": Activity,
  "Safety incidents": ShieldAlert, Aura: Activity, Dedup: Database, Docs: BookOpen,
}

// Longest-prefix match; "/lab" (Dashboard) only matches exactly.
function activeHref(pathname: string) {
  return items
    .filter((i) => (i.href === "/lab" ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + "/")))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href
}

export function breadcrumbs(pathname: string): { href: string; label: string }[] {
  const href = pathname === "/lab" ? undefined : activeHref(pathname)
  const item = items.find((i) => i.href === href)
  const auraTermPath = pathname.startsWith("/lab/aura/") ? pathname.slice("/lab/aura/".length).split("/")[0] : ""
  if (item?.href === "/lab/aura" && auraTermPath) {
    let term = auraTermPath
    try { term = decodeURIComponent(auraTermPath) } catch { /* keep the raw path segment */ }
    return [ROOT, { href: item.href, label: item.label }, { href: pathname, label: term }]
  }
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

export function LabShellView({ pathname, userName, mockLlm, showDemoPages = false, headerActions, children, collapsed = false, drawerOpen = false, onToggleCollapsed, onToggleDrawer, themePref = "system", onThemeChange, navigationProgress = null, navigationComplete = false }: {
  pathname: string
  userName: string
  mockLlm: boolean
  showDemoPages?: boolean
  headerActions?: React.ReactNode
  children: React.ReactNode
  collapsed?: boolean
  drawerOpen?: boolean
  onToggleCollapsed?: () => void
  onToggleDrawer?: () => void
  themePref?: ThemePref
  onThemeChange?: (pref: ThemePref) => void
  navigationProgress?: number | null
  navigationComplete?: boolean
}) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const active = activeHref(pathname)
  const crumbs = breadcrumbs(pathname)
  const isAuraTerm = pathname.startsWith("/lab/aura/")
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
        <ThemeToggle pref={themePref} onChange={onThemeChange} />
        <span title={userName} aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-lab-control text-xs font-medium">{initials}</span>
        <span className="sr-only">Signed in as {userName}</span>
       </div>
       {headerActions && <div className="flex justify-end px-4 pb-2">{headerActions}</div>}
       <p className="bg-lab-raised px-4 py-1 text-xs text-lab-muted">
        Teaching scaffold · signed in as mock user &quot;{userName}&quot; ·{" "}
        {mockLlm ? "mock AI and moderation" : "real AI and moderation (your own key)"}
       </p>
      </header>
      <div
        role={navigationProgress === null ? undefined : "progressbar"}
        aria-label={navigationProgress === null ? undefined : "Loading page"}
        aria-valuemin={navigationProgress === null ? undefined : 0}
        aria-valuemax={navigationProgress === null ? undefined : 100}
        aria-valuenow={navigationProgress === null ? undefined : navigationProgress}
        aria-hidden={navigationComplete || undefined}
        className="h-0.5 bg-transparent"
      >
        <span
          aria-hidden="true"
          className={`block h-full origin-left bg-primary transition-transform transition-opacity duration-150 ease-out motion-reduce:transition-none ${navigationProgress === null || navigationComplete ? "opacity-0" : "opacity-100"}`}
          style={{ transform: `scaleX(${(navigationProgress ?? 0) / 100})` }}
        />
      </div>
      <div className="flex flex-1">
        {drawerOpen && <div data-drawer-backdrop aria-hidden="true" onClick={onToggleDrawer} className="fixed inset-0 z-30 bg-lab-chrome/70 md:hidden" />}
        <aside id="lab-sidebar" className={`shrink-0 flex-col border-r border-lab-border bg-lab-chrome ${drawerOpen ? "fixed inset-y-0 left-0 z-40 flex w-60" : `hidden md:flex ${collapsed ? "md:w-14" : "w-60"}`}`}>
          <TooltipProvider>
          <nav aria-label="Lab" className="flex-1 overflow-y-auto p-2">
            {LAB_NAV.map((group) => (
              <div key={group.label}>
                <h2 className={`${collapsed ? "sr-only" : ""} px-2 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-lab-muted`}>{group.label}</h2>
                <ul>
                  {group.items.filter((item) => !item.demoOnly || showDemoPages).map((item) => {
                    const Icon = icons[item.label]
                    return <li key={item.href}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            href={item.href}
                            target={item.external ? "_blank" : undefined}
                            rel={item.external ? "noopener noreferrer" : undefined}
                            aria-current={item.href === active ? "page" : undefined}
                            title={item.label}
                            className={`flex items-center gap-2 rounded px-2 py-1.5 text-sm ${ring} ${item.href === active ? "bg-lab-raised text-lab-text" : "text-lab-muted hover:bg-lab-raised hover:text-lab-text"}`}
                          >
                            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                            {collapsed ? <span className="sr-only">{item.label}</span> : <span>{item.label}</span>}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.label}</TooltipContent>
                      </Tooltip>
                    </li>
                  })}
                </ul>
              </div>
            ))}
          </nav>
          </TooltipProvider>
          <button type="button" aria-expanded={!collapsed} aria-controls="lab-sidebar" onClick={onToggleCollapsed} className={`m-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm text-lab-muted hover:bg-lab-raised hover:text-lab-text ${ring}`}>
            {collapsed ? <PanelLeftOpen aria-hidden="true" className="h-4 w-4" /> : <PanelLeftClose aria-hidden="true" className="h-4 w-4" />}
            {collapsed ? <span className="sr-only">Expand sidebar</span> : "Collapse sidebar"}
          </button>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col bg-background">
          <nav aria-label="Breadcrumb" className="px-6 pt-4 text-sm text-lab-muted">
            <div className="flex items-center gap-3">
              {isAuraTerm && (
                <Link href="/lab/aura" aria-label="Back to Aura dashboard" className={`flex h-8 w-8 items-center justify-center rounded hover:bg-lab-raised ${ring}`}>
                  <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                </Link>
              )}
              <ol className="flex gap-2">
                {crumbs.map((c, i) => (
                  <li key={c.href} className="flex gap-2">
                    {i > 0 && <span aria-hidden="true">/</span>}
                    {i < crumbs.length - 1 ? <Link href={c.href} className={ring}>{c.label}</Link> : <span aria-current="page">{c.label}</span>}
                  </li>
                ))}
              </ol>
            </div>
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
