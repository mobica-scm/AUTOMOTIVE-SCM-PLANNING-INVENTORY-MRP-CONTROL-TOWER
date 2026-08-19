import ExcelJS from "exceljs";

export type CandidateForecastLine = {
  variantCode: string;
  periodLabel: string;
  periodStart: string; // ISO date
  lotRef?: string;
  quantityKits: number;
};

export type ForecastDetection = {
  detectedLayout: "CW_GRID" | "GENERIC_TABLE" | "UNRECOGNIZED";
  sheetName: string;
  candidateLines: CandidateForecastLine[];
  warnings: string[];
};

function cellStr(v: unknown): string | undefined {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "object" && v !== null && "text" in (v as any)) return String((v as any).text).trim();
  const s = String(v).trim();
  return s.length ? s : undefined;
}
function cellNum(v: unknown): number | undefined {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dow = jan1.getUTCDay() || 7;
  const w1Monday = new Date(jan1);
  w1Monday.setUTCDate(jan1.getUTCDate() - (dow - 1));
  const out = new Date(w1Monday);
  out.setUTCDate(w1Monday.getUTCDate() + (week - 1) * 7);
  return out;
}

/**
 * Detect a customer forecast file's layout and stage candidate lines.
 *
 * Two layouts are recognized deterministically:
 *  - CW_GRID: a wide calendar-week matrix with separate variant rows
 *    (the Citroen template — Section E of the blueprint).
 *  - GENERIC_TABLE: a row-per-line sheet with a part/material column,
 *    a quantity column, and either a date column or per-period columns.
 *
 * Nothing here writes to the database — this only produces a reviewable
 * preview (Section 5/6/42: AI/heuristic mapping proposes, a planner
 * confirms).
 */
export async function detectForecastLayout(buffer: Buffer, forecastYear: number): Promise<ForecastDetection> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as any);
  const sheet = wb.worksheets[0];
  const warnings: string[] = [];

  // --- Try CW_GRID: scan rows for one containing several "CW nn" cells,
  // then look one/two rows below for L2/L3 (or similarly labeled) rows.
  let cwRowNumber: number | null = null;
  let maxCwRow = Math.min(sheet.rowCount, 30);
  for (let r = 1; r <= maxCwRow; r++) {
    const row = sheet.getRow(r);
    let cwHits = 0;
    row.eachCell({ includeEmpty: false }, (cell) => {
      const s = cellStr(cell.value);
      if (s && /^CW\s*\d+/i.test(s)) cwHits++;
    });
    if (cwHits >= 3) {
      cwRowNumber = r;
      break;
    }
  }

  if (cwRowNumber) {
    const cwRow = sheet.getRow(cwRowNumber);
    const lastCol = sheet.actualColumnCount;

    // Find variant rows below the CW header row by label keyword.
    const variantRows: { code: string; rowNumber: number }[] = [];
    for (let r = cwRowNumber + 1; r <= Math.min(cwRowNumber + 6, sheet.rowCount); r++) {
      const label = cellStr(sheet.getRow(r).getCell(1).value);
      if (!label) continue;
      if (/level\s*2|^l2\b/i.test(label)) variantRows.push({ code: "L2", rowNumber: r });
      else if (/level\s*3|^l3\b/i.test(label)) variantRows.push({ code: "L3", rowNumber: r });
    }

    if (variantRows.length === 0) {
      warnings.push("Found a CW-grid header but no 'Level 2' / 'Level 3' rows beneath it — falling back to a single unlabeled variant.");
      variantRows.push({ code: "UNSPECIFIED", rowNumber: cwRowNumber + 1 });
    }

    const lotRowNumber = cwRowNumber - 1;
    const candidateLines: CandidateForecastLine[] = [];
    for (let c = 1; c <= lastCol; c++) {
      const cwLabel = cellStr(cwRow.getCell(c).value);
      if (!cwLabel || !/^CW\s*\d+/i.test(cwLabel)) continue;
      const cwNum = parseInt(cwLabel.replace(/\D/g, ""), 10);
      if (!cwNum || cwNum > 53) continue;
      const periodStart = mondayOfIsoWeek(forecastYear, cwNum);
      const lotRef = lotRowNumber > 0 ? cellStr(sheet.getRow(lotRowNumber).getCell(c).value) : undefined;

      for (const vr of variantRows) {
        const qty = cellNum(sheet.getRow(vr.rowNumber).getCell(c).value) ?? 0;
        if (qty > 0) {
          candidateLines.push({
            variantCode: vr.code,
            periodLabel: cwLabel.replace(/\s+/g, " ").trim(),
            periodStart: periodStart.toISOString(),
            lotRef,
            quantityKits: qty,
          });
        }
      }
    }

    if (candidateLines.length === 0) warnings.push("CW-grid layout detected, but no positive quantities were found in any period column.");

    return { detectedLayout: "CW_GRID", sheetName: sheet.name, candidateLines, warnings };
  }

  // --- Fallback: GENERIC_TABLE — header row with part/qty/date columns.
  let headerRowNumber: number | null = null;
  let cols: { part?: number; qty?: number; date?: number; variant?: number } = {};
  for (let r = 1; r <= Math.min(sheet.rowCount, 10); r++) {
    const row = sheet.getRow(r);
    const found: typeof cols = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const s = cellStr(cell.value)?.toLowerCase();
      if (!s) return;
      if (/part|material|pn\b|reference/.test(s) && !found.part) found.part = colNumber;
      else if (/qty|quantity|volume|forecast/.test(s) && !found.qty) found.qty = colNumber;
      else if (/date|period|week/.test(s) && !found.date) found.date = colNumber;
      else if (/variant|level|trim/.test(s) && !found.variant) found.variant = colNumber;
    });
    if (found.part && found.qty) {
      headerRowNumber = r;
      cols = found;
      break;
    }
  }

  if (!headerRowNumber) {
    warnings.push("Could not identify a part-number column and a quantity column in the first 10 rows. Manual mapping is required.");
    return { detectedLayout: "UNRECOGNIZED", sheetName: sheet.name, candidateLines: [], warnings };
  }

  const candidateLines: CandidateForecastLine[] = [];
  for (let r = headerRowNumber + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const qty = cellNum(row.getCell(cols.qty!).value);
    const part = cellStr(row.getCell(cols.part!).value);
    if (!part || !qty || qty <= 0) continue;
    const dateCell = cols.date ? row.getCell(cols.date).value : undefined;
    const periodStart = dateCell instanceof Date ? dateCell : new Date();
    const variant = cols.variant ? cellStr(row.getCell(cols.variant).value) ?? "UNSPECIFIED" : "UNSPECIFIED";
    candidateLines.push({
      variantCode: variant,
      periodLabel: periodStart.toISOString().slice(0, 10),
      periodStart: periodStart.toISOString(),
      lotRef: part, // generic layout: carries the customer part ref for planner mapping to internal Material
      quantityKits: qty,
    });
  }

  warnings.push("Generic tabular layout detected via column-header keywords. Review the mapping before confirming.");
  return { detectedLayout: "GENERIC_TABLE", sheetName: sheet.name, candidateLines, warnings };
}
