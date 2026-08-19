"use client";
import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: string };

// The logged-in user, per the session cookie set by /api/auth/login.
// Every mutating API route also derives its own actor from the session
// server-side (lib/session.ts's getSessionUser) rather than trusting
// this — the client-side value here is for display and for convenience
// in request bodies that don't strictly need server verification.
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then(setUser)
      .catch(() => setUser(null));
  }, []);
  return user;
}
