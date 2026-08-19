import { subDays } from "./leadTime";
import { applyOrderPolicy } from "./orderPolicy";

export type NettingInputs = {
  currentOnHand: number;
  safetyStock: number;
  moq: number;
  orderMultiple: number;
  leadTimeDays: number;
  /** One entry per period, in chronological order. */
  buckets: Date[];
  grossRequirementByBucket: (bucket: Date) => number;
  scheduledReceiptByBucket: (bucket: Date) => number;
};

export type NettingPeriod = {
  periodStart: Date;
  openingBalance: number;
  grossRequirement: number;
  scheduledReceipts: number;
  plannedReceipt: number;
  projectedAvailable: number;
  netRequirement: number;
};

export type NettingPlannedOrder = {
  needDate: Date;
  orderByDate: Date;
  grossRequirementAtNeed: number;
  netRequirement: number;
  recommendedQty: number;
};

export type NettingResult = {
  periods: NettingPeriod[];
  plannedOrders: NettingPlannedOrder[];
};

/**
 * Pure, deterministic time-phased netting for a single material —
 * the arithmetic core of the MRP engine (Section D / 17-20 of the
 * blueprint), isolated from Prisma so it can be unit-tested directly
 * against the brief's worked examples.
 *
 * Gross Requirement - Available/Scheduled Supply = Net Requirement
 * Net Requirement -> MOQ / order-multiple policy -> Planned Order
 * Planned Order Date = Need Date - Effective Lead Time
 */
export function netMaterialAcrossPeriods(inputs: NettingInputs): NettingResult {
  const { currentOnHand, safetyStock, moq, orderMultiple, leadTimeDays, buckets } = inputs;

  const periods: NettingPeriod[] = [];
  const plannedOrders: NettingPlannedOrder[] = [];
  let running = currentOnHand;

  for (const bucket of buckets) {
    const openingBalance = running;
    const grossRequirement = inputs.grossRequirementByBucket(bucket);
    const scheduledReceipts = inputs.scheduledReceiptByBucket(bucket);

    const preNet = running + scheduledReceipts - grossRequirement;
    let plannedReceipt = 0;
    let netRequirement = 0;

    if (preNet < safetyStock) {
      netRequirement = safetyStock - preNet;
      const recommendedQty = applyOrderPolicy(netRequirement, moq, orderMultiple);
      plannedReceipt = recommendedQty;

      if (recommendedQty > 0) {
        plannedOrders.push({
          needDate: bucket,
          orderByDate: subDays(bucket, leadTimeDays),
          grossRequirementAtNeed: grossRequirement,
          netRequirement,
          recommendedQty,
        });
      }
    }

    const projectedAvailable = preNet + plannedReceipt;
    running = projectedAvailable;

    periods.push({ periodStart: bucket, openingBalance, grossRequirement, scheduledReceipts, plannedReceipt, projectedAvailable, netRequirement });
  }

  return { periods, plannedOrders };
}
