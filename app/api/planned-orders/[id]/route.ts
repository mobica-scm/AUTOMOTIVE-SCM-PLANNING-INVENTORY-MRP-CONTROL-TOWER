import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  action: z.enum(["OVERRIDE", "APPROVE", "REJECT", "CONVERT"]),
  finalQty: z.number().optional(), // required for OVERRIDE
  reason: z.string().optional(),
  userId: z.string(),
});

// A single decision endpoint for a planned order — override / approve /
// reject / convert-to-PO. The system's own recommendedQty is never
// mutated; overrides are recorded alongside it (Section 38: never
// destroy the original calculation).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { action, finalQty, reason, userId } = parsed.data;

  const existing = await prisma.plannedOrder.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Planned order not found" }, { status: 404 });

  if (action === "OVERRIDE" && (finalQty === undefined || finalQty < 0)) {
    return NextResponse.json({ error: "finalQty is required and must be >= 0 for an override" }, { status: 400 });
  }

  const data: Record<string, unknown> = { decidedById: userId, decidedAt: new Date() };
  if (action === "OVERRIDE") {
    data.overrideQty = finalQty;
    data.overrideReason = reason;
    data.finalQty = finalQty;
    // status stays SUGGESTED — an override still needs approval, it just
    // changes what will be approved.
  } else if (action === "APPROVE") {
    data.status = "APPROVED";
  } else if (action === "REJECT") {
    data.status = "REJECTED";
  } else if (action === "CONVERT") {
    if (existing.status !== "APPROVED") {
      return NextResponse.json({ error: "Only an approved planned order can be converted to a purchase requisition" }, { status: 400 });
    }
    data.status = "CONVERTED";
  }

  const updated = await prisma.$transaction(async (tx) => {
    const po = await tx.plannedOrder.update({ where: { id }, data });

    // Converting doesn't just flip a status — it produces an actual PO,
    // pre-filled from the planned order's own numbers, still editable
    // by the buyer afterward.
    if (action === "CONVERT") {
      const poNumber = `PR-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id.slice(-6).toUpperCase()}`;
      await tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierPlantId: existing.supplierPlantId,
          orderDate: new Date(),
          lines: {
            create: [{ materialId: existing.materialId, quantity: existing.finalQty, requiredDate: existing.needDate }],
          },
        },
      });
    }

    return po;
  });

  await prisma.auditLog.create({
    data: {
      entityType: "PlannedOrder",
      entityId: id,
      action,
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      userId,
      reason,
    },
  });

  return NextResponse.json(updated);
}
