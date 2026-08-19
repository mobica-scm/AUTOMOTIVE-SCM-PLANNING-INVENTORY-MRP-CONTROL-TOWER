import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const shipments = await prisma.shipment.findMany({
    include: { purchaseOrder: { include: { supplierPlant: true } }, lines: { include: { material: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(shipments);
}

const bodySchema = z.object({
  blNumber: z.string().optional(),
  purchaseOrderId: z.string().optional(),
  mode: z.string().optional(),
  shippingLine: z.string().optional(),
  pol: z.string().optional(),
  pod: z.string().optional(),
  ets: z.string().optional(),
  eta: z.string().optional(),
  confidence: z.enum(["CONFIRMED", "UNCONFIRMED", "AT_RISK"]).default("UNCONFIRMED"),
  lines: z.array(z.object({ materialId: z.string(), quantity: z.number().positive(), poLineId: z.string().optional() })).min(1),
});

// A shipment only becomes "scheduled supply" to MRP once its confidence
// is CONFIRMED and it carries an eta — see lib/mrp.ts. Logging a
// shipment before its PO is finalized (seen in the real shipment log:
// "PO: Not yet") is allowed here — purchaseOrderId is optional.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { blNumber, purchaseOrderId, mode, shippingLine, pol, pod, ets, eta, confidence, lines } = parsed.data;

  const shipment = await prisma.shipment.create({
    data: {
      blNumber,
      purchaseOrderId,
      mode,
      shippingLine,
      pol,
      pod,
      ets: ets ? new Date(ets) : undefined,
      eta: eta ? new Date(eta) : undefined,
      confidence,
      lines: { create: lines.map((l) => ({ materialId: l.materialId, quantity: l.quantity, poLineId: l.poLineId })) },
    },
    include: { lines: true },
  });

  await prisma.auditLog.create({
    data: { entityType: "Shipment", entityId: shipment.id, action: "CREATE", afterJson: JSON.stringify(shipment), reason: "Logged via planner console" },
  });

  return NextResponse.json(shipment, { status: 201 });
}
