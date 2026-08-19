"use client";

import { useCallback, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { MaterialPicker, useMaterialOptions } from "@/components/MaterialPicker";

type PORow = { id: string; poNumber: string; supplierPlant: { plantName: string } };
type ShipmentRow = {
  id: string;
  blNumber: string | null;
  mode: string | null;
  pol: string | null;
  pod: string | null;
  eta: string | null;
  status: string;
  confidence: string;
  purchaseOrder: { poNumber: string; supplierPlant: { plantName: string } } | null;
  lines: { id: string; quantity: number; material: { internalRef: string } }[];
};
type DraftLine = { materialId: string; quantity: string };

function ShipmentsInner() {
  const searchParams = useSearchParams();
  const preselectedPoId = searchParams.get("poId") ?? "";

  const [shipments, setShipments] = useState<ShipmentRow[]>([]);
  const [pos, setPos] = useState<PORow[]>([]);
  const materials = useMaterialOptions();
  const [showForm, setShowForm] = useState(!!preselectedPoId);
  const [blNumber, setBlNumber] = useState("");
  const [purchaseOrderId, setPurchaseOrderId] = useState(preselectedPoId);
  const [mode, setMode] = useState("Airfreight");
  const [pol, setPol] = useState("");
  const [pod, setPod] = useState("");
  const [eta, setEta] = useState("");
  const [confidence, setConfidence] = useState<"CONFIRMED" | "UNCONFIRMED" | "AT_RISK">("UNCONFIRMED");
  const [lines, setLines] = useState<DraftLine[]>([{ materialId: "", quantity: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/shipments")
      .then((r) => r.json())
      .then(setShipments);
  }, []);
  useEffect(() => load(), [load]);
  useEffect(() => {
    fetch("/api/purchase-orders")
      .then((r) => r.json())
      .then(setPos);
  }, []);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function createShipment(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        blNumber: blNumber || undefined,
        purchaseOrderId: purchaseOrderId || undefined,
        mode,
        pol: pol || undefined,
        pod: pod || undefined,
        eta: eta || undefined,
        confidence,
        lines: lines.filter((l) => l.materialId && l.quantity).map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity) })),
      };
      if (payload.lines.length === 0) {
        setError("Add at least one line");
        return;
      }
      const res = await fetch("/api/shipments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) {
        setError(JSON.stringify(json.error ?? json));
        return;
      }
      setShowForm(false);
      setBlNumber("");
      setLines([{ materialId: "", quantity: "" }]);
      load();
    } finally {
      setBusy(false);
    }
  }

  async function advanceStatus(id: string, status: string) {
    await fetch(`/api/shipments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    load();
  }

  return (
    <>
      <PageHeader
        title="Shipments"
        subtitle="Confirmed vs. unconfirmed incoming supply — only a CONFIRMED shipment with an ETA counts as scheduled receipt in MRP."
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "Log shipment"}
          </button>
        }
      />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        {showForm && (
          <form onSubmit={createShipment} className="card p-4 flex flex-col gap-3 max-w-3xl">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">BL number</label>
                <input value={blNumber} onChange={(e) => setBlNumber(e.target.value)} placeholder="optional — 'Not yet' is allowed" className="w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Linked PO (optional)</label>
                <select value={purchaseOrderId} onChange={(e) => setPurchaseOrderId(e.target.value)} className="w-full">
                  <option value="">— none yet —</option>
                  {pos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.poNumber} ({p.supplierPlant.plantName})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Mode</label>
                <select value={mode} onChange={(e) => setMode(e.target.value)} className="w-full">
                  <option>Airfreight</option>
                  <option>Seafreight</option>
                  <option>Road</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">POL</label>
                <input value={pol} onChange={(e) => setPol(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">POD</label>
                <input value={pod} onChange={(e) => setPod(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">ETA</label>
                <input type="date" value={eta} onChange={(e) => setEta(e.target.value)} className="w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Confidence</label>
                <select value={confidence} onChange={(e) => setConfidence(e.target.value as any)} className="w-full">
                  <option value="UNCONFIRMED">Unconfirmed</option>
                  <option value="CONFIRMED">Confirmed</option>
                  <option value="AT_RISK">At risk</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Shipment items</label>
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <MaterialPicker value={l.materialId} onChange={(id) => updateLine(i, { materialId: id })} options={materials} />
                  </div>
                  <input type="number" placeholder="Qty" className="w-24" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                  <button type="button" className="btn" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn self-start" onClick={() => setLines((ls) => [...ls, { materialId: "", quantity: "" }])}>
                + Add item
              </button>
            </div>

            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <button className="btn btn-primary self-start" disabled={busy}>
              {busy ? "Logging…" : "Log shipment"}
            </button>
          </form>
        )}

        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>BL</th>
                <th>PO</th>
                <th>Mode</th>
                <th>Route</th>
                <th>ETA</th>
                <th>Confidence</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link href={`/shipments/${s.id}`} className="mono font-semibold text-[var(--accent)]">
                      {s.blNumber ?? s.id.slice(-8)}
                    </Link>
                  </td>
                  <td className="text-[var(--ink-soft)]">{s.purchaseOrder?.poNumber ?? "—"}</td>
                  <td>{s.mode ?? "—"}</td>
                  <td className="text-[var(--ink-soft)]">
                    {s.pol ?? "?"} → {s.pod ?? "?"}
                  </td>
                  <td>{s.eta ? new Date(s.eta).toLocaleDateString() : "—"}</td>
                  <td>
                    <Pill tone={s.confidence === "CONFIRMED" ? "RESOLVED" : s.confidence === "AT_RISK" ? "CRITICAL" : "MEDIUM"}>{s.confidence}</Pill>
                  </td>
                  <td>
                    <Pill tone={s.status === "DELIVERED" ? "RESOLVED" : "pill-neutral"}>{s.status}</Pill>
                  </td>
                  <td>
                    {s.status !== "DELIVERED" && (
                      <div className="flex gap-1">
                        {s.status === "PLANNED" && (
                          <button className="btn" onClick={() => advanceStatus(s.id, "IN_TRANSIT")}>
                            In transit
                          </button>
                        )}
                        {s.status === "IN_TRANSIT" && (
                          <button className="btn" onClick={() => advanceStatus(s.id, "CUSTOMS")}>
                            Customs
                          </button>
                        )}
                        <button className="btn btn-primary" onClick={() => advanceStatus(s.id, "DELIVERED")}>
                          Delivered
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--ink-soft)]">Loading…</div>}>
      <ShipmentsInner />
    </Suspense>
  );
}
