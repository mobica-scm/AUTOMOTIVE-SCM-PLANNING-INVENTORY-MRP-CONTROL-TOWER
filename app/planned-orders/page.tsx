"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { useCurrentUser } from "@/lib/useCurrentUser";

type PlannedOrder = {
  id: string;
  needDate: string;
  orderByDate: string;
  grossRequirement: number;
  netRequirement: number;
  recommendedQty: number;
  finalQty: number;
  overrideQty: number | null;
  overrideReason: string | null;
  status: string;
  calcTraceJson: string;
  material: { internalRef: string; descriptionEn: string; uom: string };
  supplierPlant: { plantName: string; supplierCompany: { name: string } };
  decidedBy: { name: string } | null;
};

const STATUS_TABS = ["SUGGESTED", "APPROVED", "REJECTED", "CONVERTED"];

export default function PlannedOrdersPage() {
  const user = useCurrentUser();
  const [status, setStatus] = useState("SUGGESTED");
  const [orders, setOrders] = useState<PlannedOrder[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [overrideDraft, setOverrideDraft] = useState<Record<string, { qty: string; reason: string }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/planned-orders?status=${status}`)
      .then((r) => r.json())
      .then(setOrders);
  }, [status]);

  useEffect(() => load(), [load]);

  async function decide(id: string, action: "OVERRIDE" | "APPROVE" | "REJECT" | "CONVERT") {
    if (!user) return;
    setBusyId(id);
    try {
      const body: Record<string, unknown> = { action, userId: user.id };
      if (action === "OVERRIDE") {
        const draft = overrideDraft[id];
        if (!draft?.qty) return;
        body.finalQty = Number(draft.qty);
        body.reason = draft.reason;
      }
      await fetch(`/api/planned-orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      load();
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <PageHeader title="Planned Orders" subtitle="System recommendations from the last MRP run. Nothing here is a purchase order until you approve it." />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-3">
        <div className="flex gap-2">
          {STATUS_TABS.map((s) => (
            <button key={s} className={`btn ${status === s ? "btn-primary" : ""}`} onClick={() => setStatus(s)}>
              {s}
            </button>
          ))}
        </div>

        {orders.length === 0 && <div className="card p-4 text-sm text-[var(--ink-soft)]">No planned orders with status {status}.</div>}

        {orders.map((po) => {
          const trace = JSON.parse(po.calcTraceJson) as Record<string, unknown>;
          const isOpen = expanded === po.id;
          const overridden = po.overrideQty !== null;
          return (
            <div key={po.id} className="card overflow-hidden">
              <div className="px-4 py-3 flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="mono font-semibold">{po.material.internalRef}</span>
                  <span className="text-sm text-[var(--ink-soft)] truncate max-w-xs">{po.material.descriptionEn}</span>
                  <Pill tone={po.status}>{po.status}</Pill>
                  {overridden && <Pill tone="MEDIUM">overridden</Pill>}
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span>
                    Need <span className="mono font-semibold">{new Date(po.needDate).toLocaleDateString()}</span>
                  </span>
                  <span>
                    Order by <span className="mono font-semibold">{new Date(po.orderByDate).toLocaleDateString()}</span>
                  </span>
                  <span>
                    Qty <span className="mono font-bold text-base">{po.finalQty.toLocaleString()}</span> {po.material.uom}
                  </span>
                  <button className="btn" onClick={() => setExpanded(isOpen ? null : po.id)}>
                    {isOpen ? "Hide why" : "Why?"}
                  </button>
                </div>
              </div>

              {isOpen && (
                <div className="border-t border-[var(--line)] px-4 py-3 bg-[var(--surface-2)] text-sm flex flex-col gap-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 mono">
                    <div>Gross requirement: {(trace.grossRequirement as number)?.toFixed(0)}</div>
                    <div>Safety stock: {(trace.safetyStock as number)?.toFixed(0)}</div>
                    <div>Net requirement: {(trace.netRequirement as number)?.toFixed(0)}</div>
                    <div>MOQ: {trace.moq as number}</div>
                    <div>Order multiple: {trace.orderMultiple as number}</div>
                    <div>Effective lead time: {trace.effectiveLeadTimeDays as number}d</div>
                    <div>Supplier: {trace.supplierPlant as string}</div>
                  </div>
                  {trace.leadTimeBreakdown != null && (
                    <div className="mono text-xs text-[var(--ink-soft)]">
                      Lead time = mfg {(trace.leadTimeBreakdown as any).manufacturingDays}d + transit {(trace.leadTimeBreakdown as any).transitDays}d +
                      customs {(trace.leadTimeBreakdown as any).customsDays}d + inspection {(trace.leadTimeBreakdown as any).inspectionDays}d
                    </div>
                  )}
                  {overridden && (
                    <div className="text-[var(--amber)]">
                      Overridden to {po.overrideQty?.toLocaleString()} by {po.decidedBy?.name ?? "—"}: "{po.overrideReason}"
                    </div>
                  )}

                  {po.status === "SUGGESTED" && (
                    <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-[var(--line)]">
                      <div>
                        <label className="text-xs font-semibold block mb-1">Override qty</label>
                        <input
                          type="number"
                          className="w-28"
                          placeholder={String(po.recommendedQty)}
                          value={overrideDraft[po.id]?.qty ?? ""}
                          onChange={(e) => setOverrideDraft((d) => ({ ...d, [po.id]: { qty: e.target.value, reason: d[po.id]?.reason ?? "" } }))}
                        />
                      </div>
                      <div className="flex-1 min-w-48">
                        <label className="text-xs font-semibold block mb-1">Reason</label>
                        <input
                          value={overrideDraft[po.id]?.reason ?? ""}
                          onChange={(e) => setOverrideDraft((d) => ({ ...d, [po.id]: { qty: d[po.id]?.qty ?? "", reason: e.target.value } }))}
                        />
                      </div>
                      <button className="btn" disabled={busyId === po.id} onClick={() => decide(po.id, "OVERRIDE")}>
                        Save override
                      </button>
                      <button className="btn btn-primary" disabled={busyId === po.id} onClick={() => decide(po.id, "APPROVE")}>
                        Approve
                      </button>
                      <button className="btn btn-danger" disabled={busyId === po.id} onClick={() => decide(po.id, "REJECT")}>
                        Reject
                      </button>
                    </div>
                  )}
                  {po.status === "APPROVED" && (
                    <div className="pt-2 border-t border-[var(--line)]">
                      <button className="btn btn-primary" disabled={busyId === po.id} onClick={() => decide(po.id, "CONVERT")}>
                        Convert to purchase requisition
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
