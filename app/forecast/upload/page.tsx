"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { Pill } from "@/components/Pill";
import { useCurrentUser } from "@/lib/useCurrentUser";

type Project = { id: string; name: string; account: { id: string; name: string } };
type CandidateLine = { variantCode: string; periodLabel: string; periodStart: string; lotRef?: string; quantityKits: number };
type Detection = { stagingId: string; detectedLayout: string; sheetName: string; candidateLines: CandidateLine[]; warnings: string[] };

export default function ForecastUploadPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(new Date().getFullYear());
  const [detection, setDetection] = useState<Detection | null>(null);
  const [lines, setLines] = useState<CandidateLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((p: Project[]) => {
        setProjects(p);
        if (p[0]) setProjectId(p[0].id);
      });
  }, []);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !projectId) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("projectId", projectId);
      form.append("year", String(year));
      const res = await fetch("/api/forecast/upload", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Upload failed");
        return;
      }
      setDetection(json);
      setLines(json.candidateLines);
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm() {
    if (!detection) return;
    setBusy(true);
    setError(null);
    try {
      const project = projects.find((p) => p.id === projectId);
      const res = await fetch("/api/forecast/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stagingId: detection.stagingId, accountId: project?.account.id, uploadedById: user?.id, lines }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Confirmation failed");
        return;
      }
      router.push(`/forecast/${json.id}`);
    } finally {
      setBusy(false);
    }
  }

  function removeLine(idx: number) {
    setLines((ls) => ls.filter((_, i) => i !== idx));
  }
  function updateVariant(idx: number, code: string) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, variantCode: code } : l)));
  }

  return (
    <>
      <PageHeader title="Upload Customer Forecast" subtitle="Upload → structure detection → planner review → confirm. Nothing is written to the plan until you confirm." />
      <div className="flex-1 overflow-auto p-6 flex flex-col gap-4 max-w-4xl">
        {!detection && (
          <form onSubmit={handleUpload} className="card p-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Account / Project</label>
              <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="w-full">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.account.name} / {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">Forecast year (for CW-grid layouts)</label>
              <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} className="w-32" />
            </div>
            <div>
              <label className="text-xs font-semibold text-[var(--ink-soft)] block mb-1">File (.xlsx)</label>
              <input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} required />
            </div>
            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <button className="btn btn-primary self-start" disabled={busy || !file}>
              {busy ? "Analyzing…" : "Analyze file"}
            </button>
          </form>
        )}

        {detection && (
          <>
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-sm font-bold">Detected layout</h2>
                <Pill tone="pill-blue">{detection.detectedLayout.replaceAll("_", " ")}</Pill>
              </div>
              <p className="text-sm text-[var(--ink-soft)]">Sheet "{detection.sheetName}" — {lines.length} candidate lines.</p>
              {detection.warnings.length > 0 && (
                <ul className="mt-2 text-sm text-[var(--amber)] list-disc pl-5">
                  {detection.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-[var(--line)] flex items-center justify-between">
                <h2 className="text-sm font-bold">Review before confirming</h2>
                <span className="text-xs text-[var(--ink-soft)]">Edit variant or remove a row, then confirm to create a new forecast version.</span>
              </div>
              <div className="max-h-[420px] overflow-auto">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Week starting</th>
                      <th>Variant</th>
                      <th>Lot / part ref</th>
                      <th>Qty</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((l, i) => (
                      <tr key={i}>
                        <td>{l.periodLabel}</td>
                        <td className="text-[var(--ink-soft)]">{new Date(l.periodStart).toLocaleDateString()}</td>
                        <td>
                          <input value={l.variantCode} onChange={(e) => updateVariant(i, e.target.value)} className="w-24" />
                        </td>
                        <td className="mono">{l.lotRef ?? "—"}</td>
                        <td className="mono font-semibold">{l.quantityKits.toLocaleString()}</td>
                        <td>
                          <button className="btn" onClick={() => removeLine(i)} type="button">
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {error && <p className="text-sm text-[var(--red)]">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={handleConfirm} disabled={busy || lines.length === 0}>
                {busy ? "Confirming…" : `Confirm & create forecast version (${lines.length} lines)`}
              </button>
              <button
                className="btn"
                onClick={() => {
                  setDetection(null);
                  setLines([]);
                  setFile(null);
                }}
              >
                Start over
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
}
