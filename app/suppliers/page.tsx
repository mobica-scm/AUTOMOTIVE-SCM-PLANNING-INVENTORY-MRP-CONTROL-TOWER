"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/PageHeader";

type SupplierRow = {
  id: string;
  plantName: string;
  supplierCompanyName: string;
  country: string | null;
  accountCode: string | null;
  leadTime: { manufacturingDays: number; transitDays: number; customsDays: number; inspectionDays: number } | null;
  effectiveLeadTimeDays: number | null;
  materialCount: number;
};

export default function SuppliersPage() {
  const [rows, setRows] = useState<SupplierRow[]>([]);
  useEffect(() => {
    fetch("/api/suppliers")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  return (
    <>
      <PageHeader title="Supplier Plants" subtitle="Lead-time components are independently configurable per plant — manufacturing, transit, customs, inspection." />
      <div className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>Plant</th>
                <th>Company</th>
                <th>Country</th>
                <th>Account code</th>
                <th>Materials</th>
                <th>Mfg</th>
                <th>Transit</th>
                <th>Customs</th>
                <th>Inspection</th>
                <th>Effective LT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="font-semibold">{r.plantName}</td>
                  <td>{r.supplierCompanyName}</td>
                  <td>{r.country ?? "—"}</td>
                  <td className="mono text-[var(--ink-soft)]">{r.accountCode ?? "—"}</td>
                  <td className="mono">{r.materialCount}</td>
                  <td className="mono">{r.leadTime?.manufacturingDays ?? "—"}</td>
                  <td className="mono">{r.leadTime?.transitDays ?? "—"}</td>
                  <td className="mono">{r.leadTime?.customsDays ?? "—"}</td>
                  <td className="mono">{r.leadTime?.inspectionDays ?? "—"}</td>
                  <td className="mono font-bold">{r.effectiveLeadTimeDays ?? "—"} d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
