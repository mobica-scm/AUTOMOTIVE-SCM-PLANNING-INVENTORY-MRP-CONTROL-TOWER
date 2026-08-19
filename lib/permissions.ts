import { NextResponse } from "next/server";
import { getSessionUser, type SessionPayload } from "./session";

/**
 * A minimal role permission matrix (Section 47 of the blueprint:
 * role-based permissions). Deliberately coarse for MVP — one gate per
 * route, not per-field — but real: every mutating route below checks
 * this instead of trusting whatever the client claims.
 */
export function requireRole(req: Request, allowed: string[]): SessionPayload | NextResponse {
  const user = getSessionUser(req);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!allowed.includes(user.role)) {
    return NextResponse.json({ error: `This action requires one of: ${allowed.join(", ")} (you are ${user.role})` }, { status: 403 });
  }
  return user;
}

export function isSessionPayload(x: SessionPayload | NextResponse): x is SessionPayload {
  return !(x instanceof NextResponse);
}
