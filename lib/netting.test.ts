import { describe, it, expect } from "vitest";
import { netMaterialAcrossPeriods } from "./netting";

const W1 = new Date("2026-01-05T00:00:00Z"); // Monday
const W2 = new Date("2026-01-12T00:00:00Z");
const W3 = new Date("2026-01-19T00:00:00Z");
const buckets = [W1, W2, W3];

function demand(byWeek: Record<string, number>) {
  return (b: Date) => byWeek[b.toISOString()] ?? 0;
}
const noSupply = () => 0;

describe("netMaterialAcrossPeriods", () => {
  it("Simple MRP: demand exceeds stock -> shortage and a planned order", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 50,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 200 }),
      scheduledReceiptByBucket: noSupply,
    });
    expect(r.plannedOrders).toHaveLength(1);
    expect(r.plannedOrders[0].recommendedQty).toBe(150);
  });

  it("No shortage: stock comfortably covers demand -> no planned orders", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 1000,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 200 }),
      scheduledReceiptByBucket: noSupply,
    });
    expect(r.plannedOrders).toHaveLength(0);
    expect(r.periods[0].projectedAvailable).toBe(800);
  });

  it("Open PO: scheduled receipt covers the gap -> no planned order needed", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 50,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 200 }),
      scheduledReceiptByBucket: (b) => (b.getTime() === W1.getTime() ? 200 : 0),
    });
    expect(r.plannedOrders).toHaveLength(0);
    expect(r.periods[0].projectedAvailable).toBe(50);
  });

  it("Delayed PO: receipt arrives one week after it's needed -> still shows a shortage in the need week", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 50,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 200 }),
      // supply arrives W2, one week late relative to the W1 requirement
      scheduledReceiptByBucket: (b) => (b.getTime() === W2.getTime() ? 200 : 0),
    });
    expect(r.periods[0].netRequirement).toBe(150);
    expect(r.plannedOrders[0].needDate).toEqual(W1);
  });

  it("MOQ: net requirement 750, MOQ 1000 -> order 1000", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 250,
      safetyStock: 0,
      moq: 1000,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 1000 }),
      scheduledReceiptByBucket: noSupply,
    });
    expect(r.plannedOrders[0].netRequirement).toBe(750);
    expect(r.plannedOrders[0].recommendedQty).toBe(1000);
  });

  it("Order multiple: net requirement 1250, multiple 500 -> order 1500", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 0,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 500,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 1250 }),
      scheduledReceiptByBucket: noSupply,
    });
    expect(r.plannedOrders[0].recommendedQty).toBe(1500);
  });

  it("Safety stock: projected available never allowed below the safety stock floor", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 500,
      safetyStock: 300,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 250 }),
      scheduledReceiptByBucket: noSupply,
    });
    // 500 - 250 = 250, below the 300 floor -> plan a receipt of 50
    expect(r.periods[0].projectedAvailable).toBe(300);
    expect(r.plannedOrders[0].recommendedQty).toBe(50);
  });

  it("Lead time: order-by date = need date minus effective lead time", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 0,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 47,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 100 }),
      scheduledReceiptByBucket: noSupply,
    });
    const expected = new Date(W1);
    expected.setUTCDate(expected.getUTCDate() - 47);
    expect(r.plannedOrders[0].orderByDate).toEqual(expected);
  });

  it("Forecast revision: increasing demand increases the planned order quantity", () => {
    const before = netMaterialAcrossPeriods({
      currentOnHand: 500,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 400 }),
      scheduledReceiptByBucket: noSupply,
    });
    const after = netMaterialAcrossPeriods({
      currentOnHand: 500,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 900 }), // revised upward
      scheduledReceiptByBucket: noSupply,
    });
    expect(before.plannedOrders).toHaveLength(0);
    expect(after.plannedOrders[0].recommendedQty).toBe(400);
  });

  it("carries a shortfall forward across periods until it's covered", () => {
    const r = netMaterialAcrossPeriods({
      currentOnHand: 100,
      safetyStock: 0,
      moq: 0,
      orderMultiple: 1,
      leadTimeDays: 0,
      buckets,
      grossRequirementByBucket: demand({ [W1.toISOString()]: 150, [W2.toISOString()]: 50 }),
      scheduledReceiptByBucket: noSupply,
    });
    // W1: 100 - 150 = -50 -> plan 50, available back to 0
    // W2: 0 - 50 = -50 -> plan 50 again
    expect(r.plannedOrders).toHaveLength(2);
    expect(r.plannedOrders[0].recommendedQty).toBe(50);
    expect(r.plannedOrders[1].recommendedQty).toBe(50);
    expect(r.periods[2].projectedAvailable).toBe(0);
  });
});
