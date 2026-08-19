import { NextRequest, NextResponse } from "next/server";
import { readSessionFromCookieHeader } from "@/lib/session";

const PUBLIC_PATHS = ["/login", "/api/auth/login"];

// Every page and API route requires a session except the login page
// itself and the login endpoint. Middleware runs on the edge runtime,
// so this reads the cookie directly rather than importing next/headers.
export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((p) => pathname === p) || pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  const session = await readSessionFromCookieHeader(req.headers.get("cookie"));

  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Forward the verified identity to route handlers as request headers
  // (not response headers) so lib/session.ts's getSessionUser() can read
  // it without re-verifying the JWT on every call.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-user-id", session.sub);
  requestHeaders.set("x-user-role", session.role);
  requestHeaders.set("x-user-name", session.name);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|ico)$).*)"],
};
