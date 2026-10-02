import "server-only"

// STUDENT-FACING MOCK AUTH — this is NOT real authentication.
//
// Production restricts the review queue to verified site admins. Here every
// request is the same synthetic, signed-in reviewer. Keep calling
// getSessionUser() / isReviewer() where production would gate access, so the
// gates survive when your code is ported back.

export interface SessionUser {
  id: string
  name: string
  email: string
}

const DEMO_REVIEWER: SessionUser = {
  id: "demo-reviewer",
  name: "Demo Reviewer",
  // Reserved .test domain — never a real address.
  email: "reviewer@example.test",
}

export async function getSessionUser(): Promise<SessionUser | null> {
  return DEMO_REVIEWER
}

export function isReviewer(_user: SessionUser): boolean {
  return true
}
