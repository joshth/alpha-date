import { HeartHandshake, Phone } from "lucide-react"
import type { CrisisKind, SafetyCategory } from "@/lib/safety/classify"
import { HelpResources } from "@/components/safety/help-resources"

// Shown instead of a slang lookup when someone types a first-person statement
// of intent to self-harm or to harm others. Calm, direct, and leads with
// emergency help; no AI content is generated for these inputs.
export function CrisisCard({ crisis, categories }: { crisis: CrisisKind; categories: SafetyCategory[] }) {
  const harmToOthers = crisis === "harm_to_others"
  return (
    <div role="alert" aria-live="assertive" className="space-y-4 rounded-lg border-2 border-red-600/60 bg-card p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
        <HeartHandshake className="h-6 w-6 text-red-600" aria-hidden="true" />
        {harmToOthers ? "Please talk to someone now" : "You don't have to go through this alone"}
      </h2>
      <p className="text-foreground/90">
        {harmToOthers
          ? "What you typed sounds like someone could get hurt. If you're thinking about hurting someone, or you're worried someone else might, please talk to someone right now."
          : "What you typed sounds like things might be really hard right now. Talking to someone can help, and it's free and confidential, any time of day or night."}
      </p>
      <a
        href="tel:000"
        className="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 font-semibold text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
      >
        <Phone className="h-5 w-5" aria-hidden="true" /> If anyone is in danger, call 000
      </a>
      <HelpResources
        categories={categories.length ? categories : [harmToOthers ? "violence_threat" : "suicide_self_harm"]}
        heading="People you can talk to"
        intro={harmToOthers ? "These services can help you work through what's going on." : "These services are here for you, day and night."}
      />
      <p className="text-sm text-muted-foreground">
        If you were looking up a phrase for someone else, the services above can also help you support them.
      </p>
      {/* Production adds: "We can't reply to messages typed here. We keep a short,
          secure safety record of them." with a privacy link. This scaffold keeps
          no safety log, so that line is omitted. */}
      <p className="text-xs text-muted-foreground">We can&apos;t reply to messages typed here.</p>
    </div>
  )
}
