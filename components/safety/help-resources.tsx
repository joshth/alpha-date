import { LifeBuoy, Phone, MessageSquare, ExternalLink } from "lucide-react"
import type { SafetyCategory } from "@/lib/safety/classify"
import { EMERGENCY, resourcesFor, type HelpResource } from "@/lib/safety/resources"

// Help-seeking information for content touching self-harm, exploitation,
// violence or bullying (Mindframe: two or more 24/7 services with direct
// links, plus an online option). Server-renderable; no client state.

function telHref(number: string): string {
  return `tel:${number.replace(/\s+/g, "")}`
}

function ResourceItem({ resource }: { resource: HelpResource }) {
  return (
    <li className="min-w-0 rounded-md border border-border bg-background/60 p-3">
      <p className="font-semibold text-foreground">{resource.name}</p>
      <p className="text-sm text-muted-foreground">{resource.detail}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {resource.phone && (
          <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" href={telHref(resource.phone)}>
            <Phone className="h-4 w-4" aria-hidden="true" /> Call {resource.phone}
          </a>
        )}
        {resource.text && (
          <a className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline" href={`sms:${resource.text.replace(/\s+/g, "")}`}>
            <MessageSquare className="h-4 w-4" aria-hidden="true" /> Text {resource.text}
          </a>
        )}
        {resource.url && (
          <a
            className="inline-flex min-w-0 items-center gap-1 break-all font-medium text-primary underline-offset-4 hover:underline"
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
}: {
  categories: SafetyCategory[]
  heading?: string
  intro?: string
}) {
  const resources = resourcesFor(categories)
  if (resources.length === 0) return null
  return (
    <section aria-labelledby="help-resources-heading" className="rounded-lg border border-emerald-600/40 bg-emerald-50/60 p-4 dark:bg-emerald-950/20">
      <h3 id="help-resources-heading" className="flex items-center gap-2 text-base font-semibold text-foreground">
        <LifeBuoy className="h-5 w-5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /> {heading}
      </h3>
      <p className="mt-1 text-sm text-foreground/90">
        {intro ??
          "This term relates to a serious topic. If it's affecting you or someone you care about, free and confidential help is available."}{" "}
        {EMERGENCY.detail}
      </p>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {resources.map((r) => (
          <ResourceItem key={r.name} resource={r} />
        ))}
      </ul>
    </section>
  )
}
