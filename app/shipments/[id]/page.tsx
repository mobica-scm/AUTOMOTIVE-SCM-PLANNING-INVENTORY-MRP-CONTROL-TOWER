"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type ShipmentDetail = {
  id: string;
  blNumber: string | null;
  mode: string | null;
  pol: string | null;
  pod: string | null;
  ets: string | null;
  eta: string | null;
  deliveredDate: string | null;
  status: string;
  confidence: string;
  purchaseOrder: { poNumber: string; supplierPlant: { plantName: string; supplierCompany: { name: string } } } | null;
  lines: { id: string; quantity: number; material: { id: string; internalRef: string; descriptionEn: string } }[];
};

export default function ShipmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [s, setS] = useState<ShipmentDetail | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/shipments/${id}`)
      .then((r) => r.json())
      .then(setS);
  }, [id]);
  useEffect(() => load(), [load]);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/shipments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!s) return <div className="p-6 text-sm text-[var(--ink-soft)]">Loading…</div>;

  return (
    <>
      <PageHeader
        title={s.blNumber ?? `Shipment ${s.id.slice(-8)}`}
        subtitle={s.purchaseOrder ? `${s.purchaseOrder.poNumber} — ${s.purchaseOrder.supplierPlant.plantName}` : "Not yet linked to a PO"}
        actions={
          <>
            <Pill tone={s.confidence === "CONFIRMED" ? "RESOLVED" : s.confidence === "AT_RISK" ? "CRITICAL" : "MEDIUM"}>{s.confidence}</Pill>
            <Pill tone={s.status === "DELIVERED" ? "RESOLVED" : "pill-neutral"}>{s.status}</Pill>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6 grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] text-sm font-bold">Items</div>
          <table className="grid">
            <thead>
              <tr>
                <th>Material</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {s.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/materials/${l.material.id}`} className="mono text-[var(--accent)] font-semibold">
                      {l.material.internalRef}
                    </Link>{" "}
                    <span className="text-[var(--ink-soft)]">{l.material.descriptionEn.slice(0, 50)}</span>
                  </td>
                  <td className="mono">{l.quantity.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Routing</h2>
            <dl className="text-sm grid grid-cols-2 gap-y-1">
              <dt className="text-[var(--ink-soft)]">Mode</dt>
              <dd>{s.mode ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">POL</dt>
              <dd>{s.pol ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">POD</dt>
              <dd>{s.pod ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">ETS</dt>
              <dd>{s.ets ? new Date(s.ets).toLocaleDateString() : "—"}</dd>
              <dt className="text-[var(--ink-soft)]">ETA</dt>
              <dd>{s.eta ? new Date(s.eta).toLocaleDateString() : "—"}</dd>
              <dt className="text-[var(--ink-soft)]">Delivered</dt>
              <dd>{s.deliveredDate ? new Date(s.deliveredDate).toLocaleDateString() : "—"}</dd>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Actions</h2>
            <div className="flex flex-col gap-2">
              {s.confidence !== "CONFIRMED" && (
                <button className="btn" disabled={busy} onClick={() => patch({ confidence: "CONFIRMED" })}>
                  Mark confidence: Confirmed
                </button>
              )}
              {s.confidence !== "AT_RISK" && (
                <button className="btn" disabled={busy} onClick={() => patch({ confidence: "AT_RISK" })}>
                  Flag: At risk
                </button>
              )}
              {s.status !== "DELIVERED" && (
                <button className="btn btn-primary" disabled={busy} onClick={() => patch({ status: "DELIVERED" })}>
                  Mark delivered (posts stock receipt)
                </button>
              )}
            </div>
            <p className="text-xs text-[var(--ink-soft)] mt-2">
              Marking delivered posts a RECEIPT inventory transaction for each item automatically — Section 33: arrival becomes available stock only
              once received.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
