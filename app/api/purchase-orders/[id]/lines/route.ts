import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, isSessionPayload } from "@/lib/permissions";

const bodySchema = z.object({
  materialId: z.string(),
  quantity: z.number().positive(),
  requiredDate: z.string().optional(),
  unitPrice: z.number().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actorOrError = requireRole(req, ["BUYER", "PLANNER", "MANAGER", "ADMIN"]);
  if (!isSessionPayload(actorOrError)) return actorOrError;

  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({ where: { id } });
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { materialId, quantity, requiredDate, unitPrice } = parsed.data;

  const line = await prisma.pOLine.create({
    data: { purchaseOrderId: id, materialId, quantity, requiredDate: requiredDate ? new Date(requiredDate) : undefined, unitPrice },
    include: { material: true },
  });

  return NextResponse.json(line, { status: 201 });
}
