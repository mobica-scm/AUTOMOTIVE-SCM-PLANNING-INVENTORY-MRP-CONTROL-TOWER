import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  type: z.enum(["RECEIPT", "ISSUE", "ADJUSTMENT", "SCRAP", "TRANSFER"]),
  quantity: z.number(),
  reference: z.string().optional(),
  note: z.string().optional(),
});

// Every stock change is posted as a new, signed InventoryTransaction —
// balances are never edited in place (Section 12/38 of the blueprint).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await prisma.material.findUnique({ where: { id } });
  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { type, quantity, reference, note } = parsed.data;
  const signedQty = type === "ISSUE" || type === "SCRAP" ? -Math.abs(quantity) : Math.abs(quantity);

  const txn = await prisma.inventoryTransaction.create({
    data: { materialId: id, type, quantity: signedQty, reference, note },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "InventoryTransaction",
      entityId: txn.id,
      action: "CREATE",
      afterJson: JSON.stringify(txn),
      reason: note ?? `${type} posted via planner console`,
    },
  });

  return NextResponse.json(txn, { status: 201 });
}
