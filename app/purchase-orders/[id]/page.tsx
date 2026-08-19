"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { MaterialPicker, useMaterialOptions } from "@/components/MaterialPicker";

type PODetail = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string | null;
  supplierPlant: { plantName: string; supplierCompany: { name: string }; leadTimeProfile: any };
  lines: { id: string; quantity: number; requiredDate: string | null; material: { id: string; internalRef: string; descriptionEn: string }; shipmentLines: { shipment: { blNumber: string | null; status: string; confidence: string } }[] }[];
  shipments: { id: string; blNumber: string | null; status: string; confidence: string; eta: string | null }[];
};

export default function PODetailPage() {
  const { id } = useParams<{ id: string }>();
  const [po, setPo] = useState<PODetail | null>(null);
  const materials = useMaterialOptions();
  const [newLine, setNewLine] = useState({ materialId: "", quantity: "", requiredDate: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/purchase-orders/${id}`)
      .then((r) => r.json())
      .then(setPo);
  }, [id]);
  useEffect(() => load(), [load]);

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!newLine.materialId || !newLine.quantity) return;
    setBusy(true);
    try {
      await fetch(`/api/purchase-orders/${id}/lines`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ materialId: newLine.materialId, quantity: Number(newLine.quantity), requiredDate: newLine.requiredDate || undefined }),
      });
      setNewLine({ materialId: "", quantity: "", requiredDate: "" });
      load();
    } finally {
      setBusy(false);
    }
  }

  if (!po) return <div className="p-6 text-sm text-[var(--ink-soft)]">Loading…</div>;

  return (
    <>
      <PageHeader
        title={po.poNumber}
        subtitle={`${po.supplierPlant.plantName} (${po.supplierPlant.supplierCompany.name})`}
        actions={<Pill tone={po.status === "OPEN" ? "SUGGESTED" : po.status}>{po.status.replaceAll("_", " ")}</Pill>}
      />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] text-sm font-bold">Lines</div>
          <table className="grid">
            <thead>
              <tr>
                <th>Material</th>
                <th>Qty</th>
                <th>Required date</th>
                <th>Shipment(s)</th>
              </tr>
            </thead>
            <tbody>
              {po.lines.map((l) => (
                <tr key={l.id}>
                  <td>
                    <Link href={`/materials/${l.material.id}`} className="mono text-[var(--accent)] font-semibold">
                      {l.material.internalRef}
                    </Link>{" "}
                    <span className="text-[var(--ink-soft)]">{l.material.descriptionEn.slice(0, 40)}</span>
                  </td>
                  <td className="mono">{l.quantity.toLocaleString()}</td>
                  <td className="text-[var(--ink-soft)]">{l.requiredDate ? new Date(l.requiredDate).toLocaleDateString() : "—"}</td>
                  <td>
                    {l.shipmentLines.length === 0 ? (
                      <span className="text-[var(--ink-soft)]">Not yet shipped</span>
                    ) : (
                      l.shipmentLines.map((sl, i) => (
                        <span key={i} className="mr-2">
                          <Pill tone={sl.shipment.confidence === "CONFIRMED" ? "RESOLVED" : "MEDIUM"}>{sl.shipment.status}</Pill>
                        </span>
                      ))
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <form onSubmit={addLine} className="flex gap-2 items-center p-3 border-t border-[var(--line)]">
            <div className="flex-1">
              <MaterialPicker value={newLine.materialId} onChange={(id) => setNewLine((n) => ({ ...n, materialId: id }))} options={materials} />
            </div>
            <input type="number" placeholder="Qty" className="w-24" value={newLine.quantity} onChange={(e) => setNewLine((n) => ({ ...n, quantity: e.target.value }))} />
            <input type="date" className="w-40" value={newLine.requiredDate} onChange={(e) => setNewLine((n) => ({ ...n, requiredDate: e.target.value }))} />
            <button className="btn btn-primary" disabled={busy}>
              Add line
            </button>
          </form>
        </div>

        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
            <span className="text-sm font-bold">Shipments</span>
            <Link href={`/shipments?poId=${po.id}`} className="btn">
              Log a shipment for this PO
            </Link>
          </div>
          {po.shipments.length === 0 ? (
            <p className="text-sm text-[var(--ink-soft)] p-4">No shipments logged yet.</p>
          ) : (
            <table className="grid">
              <thead>
                <tr>
                  <th>BL</th>
                  <th>Status</th>
                  <th>Confidence</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {po.shipments.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/shipments/${s.id}`} className="mono text-[var(--accent)] font-semibold">
                        {s.blNumber ?? s.id.slice(-8)}
                      </Link>
                    </td>
                    <td>{s.status}</td>
                    <td>
                      <Pill tone={s.confidence === "CONFIRMED" ? "RESOLVED" : s.confidence === "AT_RISK" ? "CRITICAL" : "MEDIUM"}>{s.confidence}</Pill>
                    </td>
                    <td className="text-[var(--ink-soft)]">{s.eta ? new Date(s.eta).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
