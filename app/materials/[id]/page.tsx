"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type MaterialDetail = {
  id: string;
  internalRef: string;
  supplierPartNo: string | null;
  descriptionEn: string;
  descriptionAr: string | null;
  uom: string;
  moq: number;
  orderMultiple: number;
  safetyStock: number;
  criticality: string;
  onHand: number;
  inventoryTxns: { id: string; type: string; quantity: number; reference: string | null; note: string | null; transactionDate: string }[];
  supplierMaterials: { id: string; supplierPlant: { plantName: string; country: string | null; supplierCompany: { name: string }; leadTimeProfile: any } }[];
  bomLines: { id: string; qtyPerKitL2: number; qtyPerKitL3: number; project: { name: string; account: { name: string } } }[];
  plannedOrders: { id: string; needDate: string; recommendedQty: number; finalQty: number; status: string; supplierPlant: { plantName: string } }[];
  exceptions: { id: string; type: string; severity: string; status: string; whatHappened: string; createdAt: string }[];
};

export default function MaterialDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [m, setM] = useState<MaterialDetail | null>(null);
  const [form, setForm] = useState({ type: "RECEIPT", quantity: "", reference: "", note: "" });
  const [posting, setPosting] = useState(false);

  const load = useCallback(() => {
    fetch(`/api/materials/${id}`)
      .then((r) => r.json())
      .then(setM);
  }, [id]);

  useEffect(() => load(), [load]);

  async function postTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (!form.quantity) return;
    setPosting(true);
    try {
      await fetch(`/api/materials/${id}/inventory`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: form.type, quantity: Number(form.quantity), reference: form.reference || undefined, note: form.note || undefined }),
      });
      setForm({ type: "RECEIPT", quantity: "", reference: "", note: "" });
      load();
    } finally {
      setPosting(false);
    }
  }

  if (!m) return <div className="p-6 text-sm text-[var(--ink-soft)]">Loading…</div>;

  return (
    <>
      <PageHeader
        title={m.internalRef}
        subtitle={m.descriptionEn}
        actions={
          <>
            <Pill tone={m.criticality}>{m.criticality}</Pill>
            <span className="text-sm">
              On hand: <span className="mono font-bold">{m.onHand.toLocaleString()}</span> {m.uom}
            </span>
          </>
        }
      />
      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Master data</h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <dt className="text-[var(--ink-soft)]">Supplier part no.</dt>
              <dd className="mono">{m.supplierPartNo ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">Arabic description</dt>
              <dd>{m.descriptionAr ?? "—"}</dd>
              <dt className="text-[var(--ink-soft)]">UOM</dt>
              <dd>{m.uom}</dd>
              <dt className="text-[var(--ink-soft)]">MOQ / Order multiple</dt>
              <dd className="mono">
                {m.moq} / {m.orderMultiple}
              </dd>
              <dt className="text-[var(--ink-soft)]">Safety stock</dt>
              <dd className="mono">{m.safetyStock}</dd>
            </dl>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Used in BOM</h2>
            {m.bomLines.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">Not consumed by any project BOM.</p>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Account / Project</th>
                    <th>Qty per kit (L2)</th>
                    <th>Qty per kit (L3)</th>
                  </tr>
                </thead>
                <tbody>
                  {m.bomLines.map((b) => (
                    <tr key={b.id}>
                      <td>
                        {b.project.account.name} / {b.project.name}
                      </td>
                      <td className="mono">{b.qtyPerKitL2}</td>
                      <td className="mono">{b.qtyPerKitL3}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Inventory transactions</h2>
            <table className="grid">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Qty</th>
                  <th>Reference</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {m.inventoryTxns.map((t) => (
                  <tr key={t.id}>
                    <td className="text-[var(--ink-soft)]">{new Date(t.transactionDate).toLocaleString()}</td>
                    <td>{t.type}</td>
                    <td className={`mono font-semibold ${t.quantity < 0 ? "text-[var(--red)]" : "text-[var(--green)]"}`}>
                      {t.quantity > 0 ? "+" : ""}
                      {t.quantity.toLocaleString()}
                    </td>
                    <td className="text-[var(--ink-soft)]">{t.reference ?? "—"}</td>
                    <td className="text-[var(--ink-soft)]">{t.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Planned orders for this material</h2>
            {m.plannedOrders.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">None currently — run MRP to generate a plan.</p>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th>Need date</th>
                    <th>Supplier plant</th>
                    <th>Qty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {m.plannedOrders.map((po) => (
                    <tr key={po.id}>
                      <td>{new Date(po.needDate).toLocaleDateString()}</td>
                      <td>{po.supplierPlant.plantName}</td>
                      <td className="mono">{po.finalQty.toLocaleString()}</td>
                      <td>
                        <Pill tone={po.status}>{po.status}</Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Post inventory transaction</h2>
            <form onSubmit={postTransaction} className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Type</label>
              <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                <option value="RECEIPT">Receipt</option>
                <option value="ISSUE">Issue (consumption)</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="SCRAP">Scrap</option>
                <option value="TRANSFER">Transfer</option>
              </select>
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Quantity</label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                required
              />
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Reference (PO#, GRN#…)</label>
              <input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
              <label className="text-xs font-semibold text-[var(--ink-soft)]">Note</label>
              <textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
              <button className="btn btn-primary mt-1" disabled={posting}>
                {posting ? "Posting…" : "Post transaction"}
              </button>
            </form>
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Supplier links</h2>
            {m.supplierMaterials.map((sm) => (
              <div key={sm.id} className="text-sm mb-2 pb-2 border-b border-[var(--line)] last:border-0 last:mb-0 last:pb-0">
                <div className="font-semibold">{sm.supplierPlant.plantName}</div>
                <div className="text-[var(--ink-soft)]">
                  {sm.supplierPlant.supplierCompany.name} · {sm.supplierPlant.country}
                </div>
                {sm.supplierPlant.leadTimeProfile && (
                  <div className="mono text-xs mt-1">
                    Mfg {sm.supplierPlant.leadTimeProfile.manufacturingDays}d + Transit {sm.supplierPlant.leadTimeProfile.transitDays}d + Customs{" "}
                    {sm.supplierPlant.leadTimeProfile.customsDays}d + Inspection {sm.supplierPlant.leadTimeProfile.inspectionDays}d
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="card p-4">
            <h2 className="text-sm font-bold mb-3">Exceptions</h2>
            {m.exceptions.length === 0 ? (
              <p className="text-sm text-[var(--ink-soft)]">None.</p>
            ) : (
              m.exceptions.map((ex) => (
                <div key={ex.id} className="text-sm mb-2 pb-2 border-b border-[var(--line)] last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Pill tone={ex.severity}>{ex.severity}</Pill>
                    <Pill tone={ex.status}>{ex.status}</Pill>
                  </div>
                  <p>{ex.whatHappened}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
