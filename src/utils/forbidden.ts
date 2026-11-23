/**
 * A 403 from the candidate API means different things. Only some of them mean the attempt is
 * over; marking the assessment "done" for any other 403 would lock a candidate out of an
 * attempt that is still valid.
 */
export type ForbiddenKind = "finished" | "revoked" | "other";

export function classifyForbidden(message: string): ForbiddenKind {
  const m = message.toLowerCase();
  if (m.includes("revoked")) return "revoked";
  if (
    /already (been )?completed/.test(m) ||
    m.includes("has been completed") ||
    m.includes("terminated") ||
    m.includes("malpractice") ||
    m.includes("already been submitted")
  ) {
    return "finished";
  }
  return "other";
}
