export type LeadTimeProfile = {
  manufacturingDays: number;
  transitDays: number;
  customsDays: number;
  inspectionDays: number;
};

/**
 * Total Effective Lead Time = Manufacturing + Transit + Customs + Receiving/Inspection.
 * Calendar-day sum for MVP — a working-day/holiday calendar per phase
 * (Section 15 of the blueprint) is a documented post-MVP upgrade; the
 * four phases are already independently configurable so that upgrade is
 * additive, not a rework.
 */
export function effectiveLeadTimeDays(p: LeadTimeProfile): number {
  return p.manufacturingDays + p.transitDays + p.customsDays + p.inspectionDays;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function subDays(date: Date, days: number): Date {
  return addDays(date, -days);
}
