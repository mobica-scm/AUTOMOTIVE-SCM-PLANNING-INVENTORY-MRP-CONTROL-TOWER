"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type MaterialRow = {
  id: string;
  internalRef: string;
  supplierPartNo: string | null;
  descriptionEn: string;
  uom: string;
  moq: number;
  orderMultiple: number;
  safetyStock: number;
  criticality: string;
  onHand: number;
  supplierPlantName: string | null;
  supplierCompanyName: string | null;
};

export default function MaterialsPage() {
  const [rows, setRows] = useState<MaterialRow[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      (r) =>
        r.internalRef.toLowerCase().includes(needle) ||
        r.descriptionEn.toLowerCase().includes(needle) ||
        (r.supplierPartNo ?? "").toLowerCase().includes(needle) ||
        (r.supplierCompanyName ?? "").toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <>
      <PageHeader
        title="Materials"
        subtitle={`${rows.length} materials — single source of truth for part master, MOQ, and current stock position.`}
        actions={<input placeholder="Search ref, description, supplier…" value={q} onChange={(e) => setQ(e.target.value)} className="w-72" />}
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>Internal Ref</th>
                <th>Supplier Ref</th>
                <th>Description</th>
                <th>Supplier Plant</th>
                <th>UOM</th>
                <th>On Hand</th>
                <th>Safety Stock</th>
                <th>MOQ</th>
                <th>Order Multiple</th>
                <th>Criticality</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/materials/${m.id}`} className="mono font-semibold text-[var(--accent)]">
                      {m.internalRef}
                    </Link>
                  </td>
                  <td className="mono text-[var(--ink-soft)]">{m.supplierPartNo ?? "—"}</td>
                  <td className="max-w-xs truncate" title={m.descriptionEn}>
                    {m.descriptionEn}
                  </td>
                  <td>{m.supplierPlantName ?? "—"}</td>
                  <td>{m.uom}</td>
                  <td className={`mono tabular-nums font-semibold ${m.onHand < 0 ? "text-[var(--red)]" : ""}`}>{m.onHand.toLocaleString()}</td>
                  <td className="mono tabular-nums">{m.safetyStock.toLocaleString()}</td>
                  <td className="mono tabular-nums">{m.moq.toLocaleString()}</td>
                  <td className="mono tabular-nums">{m.orderMultiple.toLocaleString()}</td>
                  <td>
                    <Pill tone={m.criticality}>{m.criticality}</Pill>
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
