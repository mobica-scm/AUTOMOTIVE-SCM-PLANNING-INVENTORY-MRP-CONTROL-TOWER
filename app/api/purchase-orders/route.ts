import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const orders = await prisma.purchaseOrder.findMany({
    include: {
      supplierPlant: { include: { supplierCompany: true } },
      lines: { include: { material: true } },
      shipments: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(orders);
}

const bodySchema = z.object({
  poNumber: z.string().min(1),
  supplierPlantId: z.string(),
  orderDate: z.string().optional(),
  lines: z
    .array(z.object({ materialId: z.string(), quantity: z.number().positive(), requiredDate: z.string().optional(), unitPrice: z.number().optional() }))
    .min(1),
});

// A PO is created directly here (buyer already has a supplier commitment)
// or via "Convert to purchase requisition" on an approved PlannedOrder
// (see /api/planned-orders/[id]). Either way it becomes visible supply
// to MRP only once a Shipment links a line to it with CONFIRMED confidence
// (Section 13 of the blueprint: confirmed vs. unconfirmed incoming supply).
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { poNumber, supplierPlantId, orderDate, lines } = parsed.data;

  const existing = await prisma.purchaseOrder.findUnique({ where: { poNumber } });
  if (existing) return NextResponse.json({ error: `PO ${poNumber} already exists` }, { status: 409 });

  const po = await prisma.purchaseOrder.create({
    data: {
      poNumber,
      supplierPlantId,
      orderDate: orderDate ? new Date(orderDate) : new Date(),
      lines: {
        create: lines.map((l) => ({
          materialId: l.materialId,
          quantity: l.quantity,
          requiredDate: l.requiredDate ? new Date(l.requiredDate) : undefined,
          unitPrice: l.unitPrice,
        })),
      },
    },
    include: { lines: true },
  });

  await prisma.auditLog.create({
    data: { entityType: "PurchaseOrder", entityId: po.id, action: "CREATE", afterJson: JSON.stringify(po), reason: "Created via planner console" },
  });

  return NextResponse.json(po, { status: 201 });
}
