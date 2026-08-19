import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole, isSessionPayload } from "@/lib/permissions";

const bodySchema = z.object({ materialId: z.string(), quantity: z.number().positive(), poLineId: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actorOrError = requireRole(req, ["BUYER", "PLANNER", "WAREHOUSE", "MANAGER", "ADMIN"]);
  if (!isSessionPayload(actorOrError)) return actorOrError;

  const { id } = await params;
  const shipment = await prisma.shipment.findUnique({ where: { id } });
  if (!shipment) return NextResponse.json({ error: "Shipment not found" }, { status: 404 });

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const line = await prisma.shipmentLine.create({
    data: { shipmentId: id, materialId: parsed.data.materialId, quantity: parsed.data.quantity, poLineId: parsed.data.poLineId },
    include: { material: true },
  });
  return NextResponse.json(line, { status: 201 });
}
