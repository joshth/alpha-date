"use client"

import { useId } from "react"
import { useSupportRegion } from "./region-provider"
import { supportRegion } from "@/lib/safety/regions"
import { LifeBuoy, Phone, MessageSquare, ExternalLink } from "lucide-react"
import type { SafetyCategory } from "@/lib/safety/classify"
import { emergencyFor, generalResourcesFor, resourcesFor, type HelpResource } from "@/lib/safety/resources"

function telHref(number: string): string {
  return `tel:${number.replace(/\s+/g, "")}`
}

function ResourceItem({ resource }: { resource: HelpResource }) {
  return (
    <li className="min-w-0 rounded-md border border-border bg-card p-3">
      <p className="font-semibold text-foreground">{resource.name}</p>
      <p className="text-sm leading-relaxed text-foreground">{resource.detail}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {resource.phone && (
          <a className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-current" href={telHref(resource.phone)}>
            <Phone className="h-4 w-4" aria-hidden="true" /> Call {resource.phone}
          </a>
        )}
        {resource.text && (
          <a className="inline-flex items-center gap-1 font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-current" href={`sms:${resource.text.replace(/\s+/g, "")}${resource.textBody ? `?body=${encodeURIComponent(resource.textBody)}` : ""}`}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Text {resource.textBody ? `${resource.textBody} to ` : ""}{resource.text}
          </a>
        )}
        {resource.url && (
          <a
            className="inline-flex min-w-0 items-center gap-1 break-all font-medium text-foreground underline decoration-primary underline-offset-4 hover:decoration-current"
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" /> {new URL(resource.url).hostname.replace(/^www\./, "")}
          </a>
        )}
      </div>
    </li>
  )
}

export function HelpResources({
  categories,
  heading = "Support is available",
  intro,
  general = false,
}: {
  categories: SafetyCategory[]
  heading?: string
  intro?: string
  general?: boolean
}) {
  const { region } = useSupportRegion()
  const country = supportRegion(region)
  const emergency = emergencyFor(region)
  const headingId = useId()
  const resources = general ? generalResourcesFor(region) : resourcesFor(categories, region)
  if (resources.length === 0) return null
  return (
    <section aria-labelledby={headingId} className="rounded-lg border border-border bg-background p-4 text-foreground">
      <h3 id={headingId} className="flex items-center gap-2 text-base font-semibold text-foreground">
        <LifeBuoy className="h-5 w-5 text-foreground" aria-hidden="true" /> {heading}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        {intro ??
          "This term relates to a serious topic. If it's affecting you or someone you care about, support is available."}{" "}
        {emergency.detail}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-foreground" role="status">Support contacts for {country.name}. Choose your current country in the header. Numbers are intended for use within that country.</p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {resources.map((r) => (
          <ResourceItem key={r.name} resource={r} />
        ))}
      </ul>
    </section>
  )
}
