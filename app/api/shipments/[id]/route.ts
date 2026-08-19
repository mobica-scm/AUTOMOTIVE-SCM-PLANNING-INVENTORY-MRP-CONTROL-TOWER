import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({
    where: { id },
    include: {
      purchaseOrder: { include: { supplierPlant: { include: { supplierCompany: true } } } },
      lines: { include: { material: true, poLine: true } },
    },
  });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
  return NextResponse.json(shipment);
}

const bodySchema = z.object({
  status: z.enum(["PLANNED", "IN_TRANSIT", "CUSTOMS", "DELIVERED"]).optional(),
  confidence: z.enum(["CONFIRMED", "UNCONFIRMED", "AT_RISK"]).optional(),
  eta: z.string().optional(),
  ets: z.string().optional(),
  customsStatus: z.string().optional(),
  userId: z.string().optional(),
});

// Section 33 of the blueprint: arrival != available inventory. Setting
// status to DELIVERED posts a RECEIPT transaction for each shipment
// line straight to available stock — this MVP treats delivery to plant
// as receiving-complete; a separate inspection/quality-hold gate is a
// documented post-MVP step (Section 33) once QC data exists to migrate.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await prisma.shipment.findUnique({ where: { id }, include: { lines: true } });
  if (!existing) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { status, confidence, eta, ets, customsStatus, userId } = parsed.data;

  const becomingDelivered = status === "DELIVERED" && existing.status !== "DELIVERED";

  const updated = await prisma.$transaction(async (tx) => {
    const s = await tx.shipment.update({
      where: { id },
      data: {
        status,
        confidence,
        eta: eta ? new Date(eta) : undefined,
        ets: ets ? new Date(ets) : undefined,
        customsStatus,
        deliveredDate: becomingDelivered ? new Date() : undefined,
      },
      include: { lines: true },
    });

    if (becomingDelivered) {
      for (const line of s.lines) {
        await tx.inventoryTransaction.create({
          data: {
            materialId: line.materialId,
            type: "RECEIPT",
            quantity: line.quantity,
            reference: `Shipment ${s.blNumber ?? s.id}`,
            note: "Auto-posted on shipment delivery",
          },
        });
      }
    }

    return s;
  });

  await prisma.auditLog.create({
    data: {
      entityType: "Shipment",
      entityId: id,
      action: "UPDATE",
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      userId,
      reason: becomingDelivered ? "Marked delivered — stock receipted automatically" : "Status/ETA updated via planner console",
    },
  });

  return NextResponse.json(updated);
}
