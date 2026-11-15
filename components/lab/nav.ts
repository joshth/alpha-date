export interface NavItem {
  href: string
  label: string
  external?: boolean
  /** Shown only when the server says the local demo is on. */
  demoOnly?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const LAB_NAV: NavGroup[] = [
  {
    label: "Lexicon",
    items: [
      { href: "/lab", label: "Dashboard" },
      { href: "/lab/search", label: "Search" },
      { href: "/lab/review", label: "Review queue" },
    ],
  },
  {
    label: "Quality",
    items: [
      { href: "/lab/eval", label: "Evaluation" },
      { href: "/lab/safety-activity", label: "Safety activity" },
      { href: "/lab/safety-incidents", label: "Safety incidents", demoOnly: true },
    ],
  },
  {
    label: "Analytics",
    items: [
      { href: "/lab/aura", label: "Aura" },
      { href: "/lab/dedup", label: "Dedup" },
    ],
  },
  { label: "Resources", items: [{ href: "http://localhost:3001", label: "Docs", external: true }] },
]
