"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";

type Version = {
  id: string;
  versionNumber: number;
  sourceFileName: string | null;
  templateName: string | null;
  status: string;
  uploadedAt: string;
  uploadedBy: { name: string } | null;
  account: { name: string };
  project: { name: string };
  _count: { lines: number };
};

export default function ForecastPage() {
  const [versions, setVersions] = useState<Version[]>([]);
  useEffect(() => {
    fetch("/api/forecast-versions")
      .then((r) => r.json())
      .then(setVersions);
  }, []);

  return (
    <>
      <PageHeader
        title="Forecast Versions"
        subtitle="Every upload creates a new, immutable version — nothing is ever overwritten."
        actions={
          <Link href="/forecast/upload" className="btn btn-primary">
            Upload forecast
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-6">
        <div className="card overflow-hidden">
          <table className="grid">
            <thead>
              <tr>
                <th>Account / Project</th>
                <th>Version</th>
                <th>Source file</th>
                <th>Template</th>
                <th>Lines</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {versions.map((v) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/forecast/${v.id}`} className="font-semibold text-[var(--accent)]">
                      {v.account.name} / {v.project.name}
                    </Link>
                  </td>
                  <td className="mono">v{v.versionNumber}</td>
                  <td className="text-[var(--ink-soft)]">{v.sourceFileName ?? "—"}</td>
                  <td className="text-[var(--ink-soft)]">{v.templateName ?? "—"}</td>
                  <td className="mono">{v._count.lines}</td>
                  <td>
                    <Pill tone={v.status}>{v.status}</Pill>
                  </td>
                  <td className="text-[var(--ink-soft)]">{new Date(v.uploadedAt).toLocaleString()}</td>
                  <td>{v.uploadedBy?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
