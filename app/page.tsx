"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type Dashboard = {
  materialCount: number;
  supplierPlantCount: number;
  openExceptions: number;
  criticalExceptions: number;
  suggestedOrders: number;
  approvedOrders: number;
  exceptionsByType: { type: string; _count: number }[];
  exceptionsBySeverity: { severity: string; _count: number }[];
  recentAudit: { id: string; entityType: string; action: string; reason: string | null; createdAt: string; user: { name: string } | null }[];
};

function StatCard({ label, value, href, tone }: { label: string; value: number | string; href?: string; tone?: "danger" }) {
  const inner = (
    <div className="card p-4 flex flex-col gap-1 hover:border-[var(--accent)] transition-colors">
      <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)] font-semibold">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${tone === "danger" && Number(value) > 0 ? "text-[var(--red)]" : ""}`}>{value}</div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default function DashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData);
  }, []);

  return (
    <>
      <PageHeader title="Control Tower" subtitle="Demand → Material Requirements → Inventory → Procurement, at a glance." />
      <div className="p-6 flex flex-col gap-6 overflow-y-auto">
        {!data ? (
          <div className="text-sm text-[var(--ink-soft)]">Loading…</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard label="Materials" value={data.materialCount} href="/materials" />
              <StatCard label="Supplier Plants" value={data.supplierPlantCount} href="/suppliers" />
              <StatCard label="Open Exceptions" value={data.openExceptions} href="/exceptions" tone="danger" />
              <StatCard label="Critical Exceptions" value={data.criticalExceptions} href="/exceptions?severity=CRITICAL" tone="danger" />
              <StatCard label="Planned Orders (suggested)" value={data.suggestedOrders} href="/planned-orders?status=SUGGESTED" />
              <StatCard label="Planned Orders (approved)" value={data.approvedOrders} href="/planned-orders?status=APPROVED" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="card p-4">
                <h2 className="text-sm font-bold mb-3">Open exceptions by type</h2>
                {data.exceptionsByType.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]">No open exceptions. Run MRP from the project screen to generate the current plan.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.exceptionsByType.map((e) => (
                      <li key={e.type} className="flex items-center justify-between text-sm">
                        <span>{e.type.replaceAll("_", " ")}</span>
                        <span className="mono font-semibold">{e._count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="card p-4">
                <h2 className="text-sm font-bold mb-3">Open exceptions by severity</h2>
                {data.exceptionsBySeverity.length === 0 ? (
                  <p className="text-sm text-[var(--ink-soft)]">Nothing outstanding.</p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {data.exceptionsBySeverity.map((e) => (
                      <li key={e.severity} className="flex items-center justify-between text-sm">
                        <Pill tone={e.severity}>{e.severity}</Pill>
                        <span className="mono font-semibold">{e._count}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="card p-4">
              <h2 className="text-sm font-bold mb-3">Recent activity (audit trail)</h2>
              <table className="grid">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Entity</th>
                    <th>Action</th>
                    <th>By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAudit.map((a) => (
                    <tr key={a.id}>
                      <td className="text-[var(--ink-soft)]">{new Date(a.createdAt).toLocaleString()}</td>
                      <td>{a.entityType}</td>
                      <td className="font-semibold">{a.action}</td>
                      <td>{a.user?.name ?? "System"}</td>
                      <td className="text-[var(--ink-soft)]">{a.reason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  );
}
