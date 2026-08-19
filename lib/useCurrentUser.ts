"use client";
import { useEffect, useState } from "react";

type User = { id: string; name: string; email: string; role: string };

// MVP has no auth layer yet (Section 47 is a documented future phase) —
// the planner console attributes actions to a fixed demo "Supply Chain
// Specialist" user so overrides/approvals still carry a real audit
// trail. Swapping in real auth later only changes how this id is
// resolved, not any of the call sites that use it.
export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((users: User[]) => setUser(users.find((u) => u.role === "PLANNER") ?? users[0] ?? null))
      .catch(() => setUser(null));
  }, []);
  return user;
}
