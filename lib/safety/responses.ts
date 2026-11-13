import type { SafetySurface, SafetyVerdict } from "@/lib/safety/gate"

export function safetyResponseMessage(verdict: SafetyVerdict, surface: SafetySurface): string {
  if (verdict.reason === "prompt_injection") {
    return "Please enter a slang term or phrase. Instructions to change the system, expose secrets or modify data are not processed."
  }
  if (verdict.action === "gentle_support") {
    return "That sounds difficult. You deserve kindness and support. If this describes how you're feeling, consider talking with someone you trust, such as a friend, parent, teacher or counsellor."
  }
  if (verdict.reason === "sensitive_suggestion") {
    return "This suggestion relates to a sensitive topic and wasn't saved. You can still search for sensitive terms to understand what they mean."
  }
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
