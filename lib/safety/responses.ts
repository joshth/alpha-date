import type { SafetySurface, SafetyVerdict } from "@/lib/safety/gate"

export function safetyResponseMessage(verdict: SafetyVerdict, surface: SafetySurface): string {
  if (verdict.decidedBy === "fail_closed") {
    return surface === "search"
      ? "We couldn't complete the safety check. Please try your search again in a moment."
      : "We couldn't complete the safety check. Your suggestion wasn't saved. Please try again in a moment."
  }
  if (verdict.action === "safeguarding") {
    return "We can't process this request. If this is affecting you or someone you care about, support is available below."
  }
  return surface === "search"
    ? "We can't look that up. If something online has upset you, the services below can help."
    : "We can't add that suggestion. If something online has upset you, the services below can help."
}
