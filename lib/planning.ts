import { prisma } from "./prisma";
import { runMrpForProject, type MrpRunResult } from "./mrp";

/**
 * Persist an MRP run: replace system-generated (SUGGESTED) planned
 * orders per material and refresh open shortage exceptions. Buyer
 * decisions (APPROVED / REJECTED / CONVERTED) are never touched by a
 * re-run — only the SUGGESTED layer is recalculated, which is what
 * keeps overrides safe across repeated MRP runs (Section 38 of the
 * blueprint: never destroy a human decision by recalculating).
 */
export async function runAndPersistMrp(projectId: string, opts?: { horizonWeeks?: number }): Promise<MrpRunResult> {
  const result = await runMrpForProject(projectId, opts);

  for (const m of result.materials) {
    await prisma.plannedOrder.deleteMany({ where: { materialId: m.materialId, status: "SUGGESTED" } });

    for (const po of m.plannedOrders) {
      await prisma.plannedOrder.create({
        data: {
          materialId: po.materialId,
          supplierPlantId: po.supplierPlantId,
          needDate: new Date(po.needDate),
          orderByDate: new Date(po.orderByDate),
          grossRequirement: po.grossRequirementAtNeed,
          netRequirement: po.netRequirement,
          recommendedQty: po.recommendedQty,
          finalQty: po.recommendedQty,
          status: "SUGGESTED",
          calcTraceJson: JSON.stringify(po.trace),
        },
      });
    }

    // Refresh shortage exceptions for this material (open, system-raised only).
    await prisma.exception.deleteMany({ where: { materialId: m.materialId, type: "SHORTAGE", status: "OPEN" } });

    if (m.plannedOrders.length > 0) {
      const earliest = m.plannedOrders.reduce((a, b) => (a.needDate < b.needDate ? a : b));
      const severity = m.worstCaseSeverity === "NONE" ? "MEDIUM" : m.worstCaseSeverity;
      await prisma.exception.create({
        data: {
          type: "SHORTAGE",
          severity,
          materialId: m.materialId,
          whatHappened: `${m.internalRef} (${m.descriptionEn}) is projected to fall below safety stock in the week of ${new Date(
            earliest.needDate
          ).toDateString()}.`,
          why: `Gross requirement from the confirmed forecast exceeds on-hand stock plus scheduled receipts; net requirement of ${earliest.netRequirement.toFixed(
            0
          )} ${m.uom} was identified.`,
          impact: `Without action, production requiring this material will not be fully supplied starting that week.`,
          recommendedAction: `Release a planned order for ${earliest.recommendedQty.toFixed(0)} ${m.uom} to ${
            m.supplierPlantName ?? "the primary supplier"
          } by ${new Date(earliest.orderByDate).toDateString()} (effective lead time ${m.effectiveLeadTimeDays} days).`,
          dueDate: new Date(earliest.orderByDate),
          owner: "Buyer",
          status: "OPEN",
        },
      });
    }
  }

  await prisma.auditLog.create({
    data: {
      entityType: "MrpRun",
      entityId: result.forecastVersionId || result.projectId,
      action: "CREATE",
      afterJson: JSON.stringify({ materialsEvaluated: result.materials.length, horizonWeeks: result.horizonWeeks }),
      reason: "MRP run triggered from planner console",
    },
  });

  return result;
}
