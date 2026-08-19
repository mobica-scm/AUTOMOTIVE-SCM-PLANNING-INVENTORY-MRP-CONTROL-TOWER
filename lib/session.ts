import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "scm_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export type SessionPayload = { sub: string; role: string; name: string };

export async function createSessionCookie(user: SessionPayload) {
  const token = await new SignJWT({ role: user.role, name: user.name })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(user.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret());

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Reads the session from the request's cookies — for use in middleware and route handlers. */
export async function readSessionFromCookieHeader(cookieHeader: string | null): Promise<SessionPayload | null> {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  if (!match) return null;
  try {
    const { payload } = await jwtVerify(match[1], getSecret());
    return { sub: payload.sub as string, role: payload.role as string, name: payload.name as string };
  } catch {
    return null;
  }
}

/** Reads the session in a route handler / server component via next/headers. */
export async function getSession(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return { sub: payload.sub as string, role: payload.role as string, name: payload.name as string };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;

/**
 * Reads the identity middleware.ts already verified and attached as
 * request headers. Route handlers use this instead of re-verifying the
 * JWT on every call — middleware is the single point that trusts the
 * cookie; everything downstream trusts middleware.
 */
export function getSessionUser(req: Request): SessionPayload | null {
  const sub = req.headers.get("x-user-id");
  const role = req.headers.get("x-user-role");
  const name = req.headers.get("x-user-name");
  if (!sub || !role) return null;
  return { sub, role, name: name ?? "" };
}
