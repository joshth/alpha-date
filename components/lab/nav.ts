export interface NavItem {
  href: string
  label: string
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
      { href: "/lab/pipeline", label: "Pipeline" },
      { href: "/lab/eval", label: "Evaluation" },
      { href: "/lab/safety-activity", label: "Safety activity" },
    ],
  },
  { label: "Analytics", items: [{ href: "/lab/aura", label: "Aura" }] },
]
