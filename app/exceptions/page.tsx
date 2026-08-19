"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { useCurrentUser } from "@/lib/useCurrentUser";

type ExceptionRow = {
  id: string;
  type: string;
  severity: string;
  status: string;
  whatHappened: string;
  why: string;
  impact: string;
  recommendedAction: string;
  dueDate: string | null;
  owner: string | null;
  createdAt: string;
  material: { id: string; internalRef: string; descriptionEn: string } | null;
};

export default function ExceptionsPage() {
  const user = useCurrentUser();
  const [status, setStatus] = useState("OPEN");
  const [rows, setRows] = useState<ExceptionRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/exceptions?status=${status}`)
      .then((r) => r.json())
      .then(setRows);
  }, [status]);

  useEffect(() => load(), [load]);

  async function resolve(id: string) {
    setBusyId(id);
    try {
      await fetch(`/api/exceptions/${id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id }),
      });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Exceptions" subtitle="What happened, why, what it affects, and the recommended action — one queue for everything that needs a decision." />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        <div className="flex gap-2">
          {["OPEN", "ACKNOWLEDGED", "RESOLVED"].map((s) => (
            <button key={s} className={`btn ${status === s ? "btn-primary" : ""}`} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>

        {rows.length === 0 && <div className="card p-4 text-sm text-[var(--ink-soft)]">Nothing here. Run MRP to (re)generate exceptions from the current plan.</div>}

        {rows.map((ex) => (
          <div key={ex.id} className="card p-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Pill tone={ex.severity}>{ex.severity}</Pill>
              <Pill tone="pill-neutral">{ex.type.replaceAll("_", " ")}</Pill>
              {ex.material && (
                <Link href={`/materials/${ex.material.id}`} className="mono text-sm font-semibold text-[var(--accent)]">
                  {ex.material.internalRef}
                </Link>
              )}
              {ex.dueDate && <span className="text-xs text-[var(--ink-soft)] ml-auto">Due {new Date(ex.dueDate).toLocaleDateString()}</span>}
            </div>
            <p className="text-sm font-semibold">{ex.whatHappened}</p>
            <dl className="text-sm grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Why</dt>
                <dd>{ex.why}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Impact</dt>
                <dd>{ex.impact}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Recommended action</dt>
                <dd>{ex.recommendedAction}</dd>
              </div>
            </dl>
            {ex.status === "OPEN" && (
              <div className="flex justify-end">
                <button className="btn btn-primary" disabled={busyId === ex.id} onClick={() => resolve(ex.id)}>
                  Mark resolved
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}
