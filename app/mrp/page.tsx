"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type Project = { id: string; name: string; account: { name: string } };

type PeriodRow = {
  periodStart: string;
  periodLabel: string;
  openingBalance: number;
  grossRequirement: number;
  scheduledReceipts: number;
  plannedReceipt: number;
  projectedAvailable: number;
  safetyStock: number;
  netRequirement: number;
};
type MaterialResult = {
  materialId: string;
  internalRef: string;
  descriptionEn: string;
  uom: string;
  supplierPlantName: string | null;
  moq: number;
  orderMultiple: number;
  effectiveLeadTimeDays: number;
  currentOnHand: number;
  periods: PeriodRow[];
  plannedOrders: unknown[];
  worstCaseSeverity: string;
};
type MrpResult = { projectId: string; forecastVersionId: string; horizonWeeks: number; generatedAt: string; materials: MaterialResult[] };

export default function MrpPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [horizon, setHorizon] = useState(16);
  const [result, setResult] = useState<MrpResult | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [onlyShortages, setOnlyShortages] = useState(true);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((p: Project[]) => {
        setProjects(p);
        if (p[0]) setProjectId(p[0].id);
      });
  }, []);

  async function loadPreview() {
    if (!projectId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/mrp/latest?projectId=${projectId}&horizonWeeks=${horizon}`);
      setResult(await res.json());
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (projectId) loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, horizon]);

  async function publish() {
    setPublishing(true);
    try {
      const res = await fetch("/api/mrp/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, horizonWeeks: horizon }),
      });
      setResult(await res.json());
    } finally {
      setPublishing(false);
    }
  }

  const materials = useMemo(() => {
    if (!result) return [];
    return onlyShortages ? result.materials.filter((m) => m.plannedOrders.length > 0) : result.materials;
  }, [result, onlyShortages]);

  return (
    <>
      <PageHeader
        title="Time-Phased MRP"
        subtitle="Gross requirement − available/scheduled supply = net requirement, week by week."
        actions={
          <>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.account.name} / {p.name}
                </option>
              ))}
            </select>
            <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>
              <option value={8}>8 weeks</option>
              <option value={16}>16 weeks</option>
              <option value={26}>26 weeks</option>
              <option value={52}>52 weeks</option>
            </select>
            <button className="btn btn-primary" onClick={publish} disabled={publishing}>
              {publishing ? "Running…" : "Run & publish"}
            </button>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyShortages} onChange={(e) => setOnlyShortages(e.target.checked)} />
          Show only materials with a projected shortage
        </label>

        {loading && <div className="text-sm text-[var(--ink-soft)]">Calculating…</div>}

        {!loading && result && materials.length === 0 && (
          <div className="card p-4 text-sm text-[var(--ink-soft)]">No materials to show — either no shortages in this horizon, or this project has no confirmed forecast yet.</div>
        )}

        {materials.map((m) => (
          <div key={m.materialId} className="card overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-left"
              onClick={() => setExpanded(expanded === m.materialId ? null : m.materialId)}
            >
              <div className="flex items-center gap-3">
                <span className="mono font-semibold">{m.internalRef}</span>
                <span className="text-[var(--ink-soft)] text-sm truncate max-w-md">{m.descriptionEn}</span>
                <Pill tone={m.worstCaseSeverity}>{m.worstCaseSeverity}</Pill>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <span>
                  On hand <span className="mono font-semibold">{m.currentOnHand.toLocaleString()}</span>
                </span>
                <span>
                  Lead time <span className="mono font-semibold">{m.effectiveLeadTimeDays}d</span>
                </span>
                <span className="text-[var(--ink-soft)]">{expanded === m.materialId ? "▲" : "▼"}</span>
              </div>
            </button>
            {expanded === m.materialId && (
              <div className="overflow-x-auto border-t border-[var(--line)]">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Metric</th>
                      {m.periods.map((p) => (
                        <th key={p.periodStart}>{p.periodLabel}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <MetricRow label="Opening balance" periods={m.periods} field="openingBalance" />
                    <MetricRow label="Gross requirement" periods={m.periods} field="grossRequirement" negative />
                    <MetricRow label="Scheduled receipts" periods={m.periods} field="scheduledReceipts" positive />
                    <MetricRow label="Planned receipt" periods={m.periods} field="plannedReceipt" positive />
                    <MetricRow label="Projected available" periods={m.periods} field="projectedAvailable" emphasize />
                    <MetricRow label="Safety stock" periods={m.periods} field="safetyStock" />
                    <MetricRow label="Net requirement" periods={m.periods} field="netRequirement" negative />
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function MetricRow({
  label,
  periods,
  field,
  negative,
  positive,
  emphasize,
}: {
  label: string;
  periods: PeriodRow[];
  field: keyof PeriodRow;
  negative?: boolean;
  positive?: boolean;
  emphasize?: boolean;
}) {
  return (
    <tr>
      <td className={`font-semibold ${emphasize ? "" : "text-[var(--ink-soft)]"}`}>{label}</td>
      {periods.map((p) => {
        const v = p[field] as number;
        const isBad = (negative && v > 0) || (emphasize && v < p.safetyStock);
        return (
          <td key={p.periodStart} className={`mono tabular-nums ${isBad ? "text-[var(--red)] font-bold" : positive && v > 0 ? "text-[var(--green)]" : ""}`}>
            {v ? Math.round(v).toLocaleString() : v === 0 ? "0" : "—"}
          </td>
        );
      })}
    </tr>
  );
}
