"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const DEMO_ACCOUNTS = [
  { email: "planner@mobica.demo", role: "Supply Chain Specialist" },
  { email: "buyer@mobica.demo", role: "Buyer" },
  { email: "manager@mobica.demo", role: "SCM Manager" },
  { email: "warehouse@mobica.demo", role: "Warehouse" },
];

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("planner@mobica.demo");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Sign-in failed");
        return;
      }
      router.push(searchParams.get("next") || "/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)]">
      <div className="card p-8 w-full max-w-sm">
        <div className="text-[10px] tracking-widest uppercase text-[var(--ink-soft)] font-semibold mb-1">Mobica</div>
        <h1 className="text-lg font-bold mb-6">SCM Control Tower</h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Email</label>
            <select value={email} onChange={(e) => setEmail(e.target.value)} className="w-full">
              {DEMO_ACCOUNTS.map((a) => (
                <option key={a.email} value={a.email}>
                  {a.role} — {a.email}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mobica-demo" className="w-full" required />
          </div>
          {error && <p className="text-sm text-[var(--red)]">{error}</p>}
          <button className="btn btn-primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="text-xs text-[var(--ink-soft)] mt-4">
          Demo credentials: any account above, password <span className="mono">mobica-demo</span>.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
