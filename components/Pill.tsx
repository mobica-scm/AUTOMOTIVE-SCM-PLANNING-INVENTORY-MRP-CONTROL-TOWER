const TONE_MAP: Record<string, string> = {
  NONE: "pill-neutral",
  LOW: "pill-blue",
  MEDIUM: "pill-amber",
  HIGH: "pill-amber",
  CRITICAL: "pill-red",
  OPEN: "pill-red",
  ACKNOWLEDGED: "pill-amber",
  RESOLVED: "pill-green",
  SUGGESTED: "pill-blue",
  APPROVED: "pill-green",
  REJECTED: "pill-neutral",
  CONVERTED: "pill-green",
  DRAFT: "pill-neutral",
  CONFIRMED: "pill-green",
  SUPERSEDED: "pill-neutral",
  STANDARD: "pill-neutral",
  CRITICAL_MATERIAL: "pill-red",
};

export function Pill({ tone, children }: { tone: string; children: React.ReactNode }) {
  const cls = TONE_MAP[tone] ?? "pill-neutral";
  return <span className={`pill ${cls}`}>{children}</span>;
}
