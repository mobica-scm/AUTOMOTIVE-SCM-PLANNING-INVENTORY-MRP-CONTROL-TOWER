import { prisma } from "./prisma";
import { effectiveLeadTimeDays } from "./leadTime";
import { netMaterialAcrossPeriods } from "./netting";

export type PeriodRow = {
  periodStart: string; // ISO date, Monday of the week
  periodLabel: string;
  openingBalance: number;
  grossRequirement: number;
  scheduledReceipts: number;
  plannedReceipt: number;
  projectedAvailable: number;
  safetyStock: number;
  netRequirement: number;
};

export type MaterialMrpResult = {
  materialId: string;
  internalRef: string;
  descriptionEn: string;
  uom: string;
  supplierPlantId: string | null;
  supplierPlantName: string | null;
  moq: number;
  orderMultiple: number;
  effectiveLeadTimeDays: number;
  currentOnHand: number;
  periods: PeriodRow[];
  plannedOrders: PlannedOrderRecommendation[];
  worstCaseSeverity: "NONE" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
};

export type PlannedOrderRecommendation = {
  materialId: string;
  supplierPlantId: string;
  needDate: string;
  orderByDate: string;
  grossRequirementAtNeed: number;
  netRequirement: number;
  recommendedQty: number;
  trace: Record<string, unknown>;
};

export type MrpRunResult = {
  projectId: string;
  forecastVersionId: string;
  horizonWeeks: number;
  generatedAt: string;
  materials: MaterialMrpResult[];
};

function mondayOf(d: Date): Date {
  const day = d.getUTCDay() || 7;
  const out = new Date(d);
  out.setUTCDate(d.getUTCDate() - (day - 1));
  out.setUTCHours(0, 0, 0, 0);
  return out;
}
function addWeeks(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n * 7);
  return out;
}
function isoWeekLabel(d: Date): string {
  const jan1 = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const days = Math.round((d.getTime() - jan1.getTime()) / 86400000);
  const week = Math.floor(days / 7) + 1;
  return `CW ${String(week).padStart(2, "0")}`;
}

/**
 * Time-phased MRP for every material consumed by `projectId`'s BOM,
 * netted against the latest CONFIRMED forecast version, current
 * inventory position, and any scheduled (PO/shipment) receipts.
 *
 * Read-only: computes and returns a result. Persisting it as
 * PlannedOrder / Exception rows is a separate, explicit step
 * (see lib/planning.ts) so a planner can preview an MRP run before it
 * writes anything.
 */
export async function runMrpForProject(projectId: string, opts?: { horizonWeeks?: number }): Promise<MrpRunResult> {
  const horizonWeeks = opts?.horizonWeeks ?? 26;

  const forecastVersion = await prisma.forecastVersion.findFirst({
    where: { projectId, status: "CONFIRMED" },
    orderBy: { versionNumber: "desc" },
    include: { lines: true },
  });
  if (!forecastVersion) {
    return { projectId, forecastVersionId: "", horizonWeeks, generatedAt: new Date().toISOString(), materials: [] };
  }

  const bomLines = await prisma.bOMLine.findMany({
    where: { projectId },
    include: {
      material: {
        include: {
          supplierMaterials: { include: { supplierPlant: { include: { leadTimeProfile: true, supplierCompany: true } } } },
          inventoryTxns: true,
          poLines: { include: { purchaseOrder: true, shipmentLines: { include: { shipment: true } } } },
        },
      },
    },
  });

  const today = mondayOf(new Date());
  const buckets = Array.from({ length: horizonWeeks }, (_, i) => addWeeks(today, i));

  const materials: MaterialMrpResult[] = [];

  for (const bom of bomLines) {
    const material = bom.material;
    const currentOnHand = material.inventoryTxns.reduce((sum, t) => sum + t.quantity, 0);

    const primarySM = material.supplierMaterials.find((sm) => sm.isPrimary) ?? material.supplierMaterials[0];
    const supplierPlant = primarySM?.supplierPlant;
    const ltp = supplierPlant?.leadTimeProfile;
    const leadDays = ltp ? effectiveLeadTimeDays(ltp) : 0;
    const moq = primarySM?.moq ?? material.moq;
    const orderMultiple = primarySM?.orderMultiple ?? material.orderMultiple;
    const safetyStock = material.safetyStock;

    // Scheduled receipts: PO lines with a required date (or their
    // shipment's ETA, if later/known), bucketed by week. Everything
    // without a linked, confirmed shipment is unconfirmed supply and is
    // NOT counted in scheduledReceipts — it must earn its way into the
    // plan by actually shipping.
    const scheduledByWeek = new Map<string, number>();
    for (const line of material.poLines) {
      const confirmedShipment = line.shipmentLines.find((sl) => sl.shipment.confidence === "CONFIRMED");
      const receiptDate = confirmedShipment?.shipment.eta ?? undefined;
      if (!receiptDate) continue; // unconfirmed — excluded from netting by design
      const wk = mondayOf(new Date(receiptDate)).toISOString();
      scheduledByWeek.set(wk, (scheduledByWeek.get(wk) ?? 0) + line.quantity);
    }

    // Gross requirement per week from the forecast, exploded through
    // this material's BOM line (variant-scoped consumption).
    const grossByWeek = new Map<string, number>();
    for (const fl of forecastVersion.lines) {
      const wk = mondayOf(new Date(fl.periodStart)).toISOString();
      const perKit = fl.variantCode === "L2" ? bom.qtyPerKitL2 : fl.variantCode === "L3" ? bom.qtyPerKitL3 : 0;
      if (perKit === 0) continue;
      const req = fl.quantityKits * perKit * (1 + bom.scrapPct / 100);
      grossByWeek.set(wk, (grossByWeek.get(wk) ?? 0) + req);
    }

    const netted = netMaterialAcrossPeriods({
      currentOnHand,
      safetyStock,
      moq,
      orderMultiple,
      leadTimeDays: leadDays,
      buckets,
      grossRequirementByBucket: (b) => grossByWeek.get(b.toISOString()) ?? 0,
      scheduledReceiptByBucket: (b) => scheduledByWeek.get(b.toISOString()) ?? 0,
    });

    const periods: PeriodRow[] = netted.periods.map((p) => ({
      periodStart: p.periodStart.toISOString(),
      periodLabel: isoWeekLabel(p.periodStart),
      openingBalance: p.openingBalance,
      grossRequirement: p.grossRequirement,
      scheduledReceipts: p.scheduledReceipts,
      plannedReceipt: p.plannedReceipt,
      projectedAvailable: p.projectedAvailable,
      safetyStock,
      netRequirement: p.netRequirement,
    }));

    const plannedOrders: PlannedOrderRecommendation[] = supplierPlant
      ? netted.plannedOrders.map((po) => ({
          materialId: material.id,
          supplierPlantId: supplierPlant.id,
          needDate: po.needDate.toISOString(),
          orderByDate: po.orderByDate.toISOString(),
          grossRequirementAtNeed: po.grossRequirementAtNeed,
          netRequirement: po.netRequirement,
          recommendedQty: po.recommendedQty,
          trace: {
            grossRequirement: po.grossRequirementAtNeed,
            safetyStock,
            netRequirement: po.netRequirement,
            moq,
            orderMultiple,
            effectiveLeadTimeDays: leadDays,
            leadTimeBreakdown: ltp
              ? {
                  manufacturingDays: ltp.manufacturingDays,
                  transitDays: ltp.transitDays,
                  customsDays: ltp.customsDays,
                  inspectionDays: ltp.inspectionDays,
                }
              : null,
            supplierPlant: supplierPlant.plantName,
          },
        }))
      : [];

    const worst = plannedOrders.length === 0 ? "NONE" : plannedOrders.some((o) => o.needDate < today.toISOString()) ? "CRITICAL" : plannedOrders.length > 3 ? "HIGH" : "MEDIUM";

    materials.push({
      materialId: material.id,
      internalRef: material.internalRef,
      descriptionEn: material.descriptionEn,
      uom: material.uom,
      supplierPlantId: supplierPlant?.id ?? null,
      supplierPlantName: supplierPlant?.plantName ?? null,
      moq,
      orderMultiple,
      effectiveLeadTimeDays: leadDays,
      currentOnHand,
      periods,
      plannedOrders,
      worstCaseSeverity: worst,
    });
  }

  materials.sort((a, b) => (b.plannedOrders.length > 0 ? 1 : 0) - (a.plannedOrders.length > 0 ? 1 : 0));

  return {
    projectId,
    forecastVersionId: forecastVersion.id,
    horizonWeeks,
    generatedAt: new Date().toISOString(),
    materials,
  };
}
