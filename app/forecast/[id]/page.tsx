"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type VersionDetail = {
  id: string;
  versionNumber: number;
  sourceFileName: string | null;
  status: string;
  notes: string | null;
  account: { name: string };
  project: { name: string };
  lines: { id: string; variantCode: string; periodLabel: string; periodStart: string; lotRef: string | null; quantityKits: number }[];
};

export default function ForecastVersionPage() {
  const { id } = useParams<{ id: string }>();
  const [v, setV] = useState<VersionDetail | null>(null);

  useEffect(() => {
    fetch(`/api/forecast-versions/${id}`)
      .then((r) => r.json())
      .then(setV);
  }, [id]);

  if (!v) return <div className="p-6 text-sm text-[var(--ink-soft)]">Loading…</div>;

  const totalL2 = v.lines.filter((l) => l.variantCode === "L2").reduce((s, l) => s + l.quantityKits, 0);
  const totalL3 = v.lines.filter((l) => l.variantCode === "L3").reduce((s, l) => s + l.quantityKits, 0);

  return (
    <>
      <PageHeader
        title={`${v.account.name} / ${v.project.name} — v${v.versionNumber}`}
        subtitle={v.sourceFileName ?? undefined}
        actions={<Pill tone={v.status}>{v.status}</Pill>}
      />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        <div className="flex gap-4">
          <div className="card p-4 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Total L2 kits</div>
            <div className="text-2xl font-bold mono">{totalL2.toLocaleString()}</div>
          </div>
          <div className="card p-4 flex-1">
            <div className="text-[11px] uppercase tracking-wide text-[var(--ink-soft)] font-semibold">Total L3 kits</div>
            <div className="text-2xl font-bold mono">{totalL3.toLocaleString()}</div>
          </div>
        </div>
        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>Period</th>
                <th>Week starting</th>
                <th>Variant</th>
                <th>Lot ref</th>
                <th>Qty (kits)</th>
              </tr>
            </thead>
            <tbody>
              {v.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.periodLabel}</td>
                  <td className="text-[var(--ink-soft)]">{new Date(l.periodStart).toLocaleDateString()}</td>
                  <td>
                    <Pill tone={l.variantCode}>{l.variantCode}</Pill>
                  </td>
                  <td className="mono">{l.lotRef ?? "—"}</td>
                  <td className="mono font-semibold">{l.quantityKits.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
