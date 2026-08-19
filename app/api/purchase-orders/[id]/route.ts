import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await prisma.purchaseOrder.findUnique({
    where: { id },
    include: {
      supplierPlant: { include: { supplierCompany: true, leadTimeProfile: true } },
      lines: { include: { material: true, shipmentLines: { include: { shipment: true } } } },
      shipments: { include: { lines: { include: { material: true } } } },
    },
  });
  if (!po) return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
  return NextResponse.json(po);
}
