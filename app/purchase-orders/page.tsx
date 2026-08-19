"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { MaterialPicker, useMaterialOptions } from "@/components/MaterialPicker";

type SupplierPlant = { id: string; plantName: string; supplierCompanyName: string };
type PORow = {
  id: string;
  poNumber: string;
  status: string;
  orderDate: string | null;
  supplierPlant: { plantName: string; supplierCompany: { name: string } };
  lines: { id: string; quantity: number; material: { internalRef: string } }[];
  shipments: { id: string }[];
};

type DraftLine = { materialId: string; quantity: string; requiredDate: string };

export default function PurchaseOrdersPage() {
  const [orders, setOrders] = useState<PORow[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierPlant[]>([]);
  const materials = useMaterialOptions();
  const [showForm, setShowForm] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [supplierPlantId, setSupplierPlantId] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([{ materialId: "", quantity: "", requiredDate: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/purchase-orders")
      .then((r) => r.json())
      .then(setOrders);
  }, []);

  useEffect(() => load(), [load]);
  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then((s: SupplierPlant[]) => {
        setSuppliers(s);
        if (s[0]) setSupplierPlantId(s[0].id);
      });
  }, []);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function createPO(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const payload = {
        poNumber,
        supplierPlantId,
        lines: lines
          .filter((l) => l.materialId && l.quantity)
          .map((l) => ({ materialId: l.materialId, quantity: Number(l.quantity), requiredDate: l.requiredDate || undefined })),
      };
      if (payload.lines.length === 0) {
        setError("Add at least one line");
        return;
      }
      const res = await fetch("/api/purchase-orders", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) {
        setError(JSON.stringify(json.error ?? json));
        return;
      }
      setPoNumber("");
      setLines([{ materialId: "", quantity: "", requiredDate: "" }]);
      setShowForm(false);
      load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Purchase Orders"
        subtitle="Confirmed commitments to a supplier plant. A PO line only becomes scheduled supply to MRP once a confirmed shipment links to it."
        actions={
          <button className="btn btn-primary" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "Cancel" : "New purchase order"}
          </button>
        }
      />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4">
        {showForm && (
          <form onSubmit={createPO} className="card p-4 flex flex-col gap-3 max-w-3xl">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">PO number</label>
                <input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required className="w-full" />
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Supplier plant</label>
                <select value={supplierPlantId} onChange={(e) => setSupplierPlantId(e.target.value)} className="w-full">
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.plantName} ({s.supplierCompanyName})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Lines</label>
              {lines.map((l, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="flex-1">
                    <MaterialPicker value={l.materialId} onChange={(id) => updateLine(i, { materialId: id })} options={materials} />
                  </div>
                  <input type="number" placeholder="Qty" className="w-24" value={l.quantity} onChange={(e) => updateLine(i, { quantity: e.target.value })} />
                  <input type="date" className="w-40" value={l.requiredDate} onChange={(e) => updateLine(i, { requiredDate: e.target.value })} />
                  <button type="button" className="btn" onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}>
                    ✕
                  </button>
                </div>
              ))}
              <button type="button" className="btn self-start" onClick={() => setLines((ls) => [...ls, { materialId: "", quantity: "", requiredDate: "" }])}>
                + Add line
              </button>
            </div>

            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <button className="btn btn-primary self-start" disabled={busy}>
              {busy ? "Creating…" : "Create purchase order"}
            </button>
          </form>
        )}

        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>PO #</th>
                <th>Supplier plant</th>
                <th>Order date</th>
                <th>Lines</th>
                <th>Shipments</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((po) => (
                <tr key={po.id}>
                  <td>
                    <Link href={`/purchase-orders/${po.id}`} className="mono font-semibold text-[var(--accent)]">
                      {po.poNumber}
                    </Link>
                  </td>
                  <td>
                    {po.supplierPlant.plantName} ({po.supplierPlant.supplierCompany.name})
                  </td>
                  <td className="text-[var(--ink-soft)]">{po.orderDate ? new Date(po.orderDate).toLocaleDateString() : "—"}</td>
                  <td className="mono">{po.lines.length}</td>
                  <td className="mono">{po.shipments.length}</td>
                  <td>
                    <Pill tone={po.status === "OPEN" ? "SUGGESTED" : po.status === "RECEIVED" ? "RESOLVED" : po.status}>{po.status.replaceAll("_", " ")}</Pill>
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
