import type React from "react"
import Link from "next/link"
import { PanelLeftClose } from "lucide-react"
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

export function LabShellView({ pathname, userName, mockLlm, children }: {
  pathname: string
  userName: string
  mockLlm: boolean
  children: React.ReactNode
}) {
  const initials = userName.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
  const active = activeHref(pathname)
  const crumbs = breadcrumbs(pathname)
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 items-center gap-4 border-b border-lab-border bg-lab-chrome px-4">
        <Link href="/lab" className={`font-semibold ${ring}`}>Lexicon Lab</Link>
        <form role="search" action="/lab/search" className="relative mx-auto w-full max-w-md">
          <label htmlFor="lab-search" className="sr-only">Search or go to</label>
          <input id="lab-search" name="q" type="search" placeholder="Search or go to…" aria-keyshortcuts="/" className={`h-8 w-full rounded border border-lab-border-strong bg-lab-input px-3 text-sm text-lab-text placeholder:text-lab-muted ${ring}`} />
          <kbd aria-hidden="true" className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-lab-muted">/</kbd>
        </form>
        <span title={userName} aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-lab-control text-xs font-medium">{initials}</span>
        <span className="sr-only">Signed in as {userName}</span>
      </header>
      <p className="bg-lab-raised px-4 py-1 text-xs text-lab-muted">
        Teaching scaffold · signed in as mock user &quot;{userName}&quot; ·{" "}
        {mockLlm ? "mock AI and moderation" : "real AI and moderation (your own key)"}
      </p>
      <div className="flex flex-1">
        <aside id="lab-sidebar" className="flex w-60 shrink-0 flex-col border-r border-lab-border bg-lab-chrome">
          <nav aria-label="Lab" className="flex-1 overflow-y-auto p-2">
            {LAB_NAV.map((group) => (
              <div key={group.label}>
                <h2 className="px-2 pb-1 pt-4 text-xs font-medium uppercase tracking-wide text-lab-muted">{group.label}</h2>
                <ul>
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={item.href === active ? "page" : undefined}
                        className={`block rounded px-2 py-1.5 text-sm ${ring} ${item.href === active ? "bg-lab-raised text-lab-text" : "text-lab-muted hover:bg-lab-raised hover:text-lab-text"}`}
                      >{item.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
          <button type="button" aria-expanded="true" aria-controls="lab-sidebar" className={`m-2 flex items-center gap-2 rounded px-2 py-1.5 text-sm text-lab-muted hover:bg-lab-raised hover:text-lab-text ${ring}`}>
            <PanelLeftClose aria-hidden="true" className="h-4 w-4" />
            Collapse sidebar
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
