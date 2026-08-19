import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const material = await prisma.material.findUnique({
    where: { id },
    include: {
      inventoryTxns: { orderBy: { transactionDate: "desc" } },
      supplierMaterials: { include: { supplierPlant: { include: { supplierCompany: true, leadTimeProfile: true } } } },
      bomLines: { include: { project: { include: { account: true } } } },
      plannedOrders: { orderBy: { createdAt: "desc" }, include: { supplierPlant: true } },
      exceptions: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!material) return NextResponse.json({ error: "Material not found" }, { status: 404 });

  const onHand = material.inventoryTxns.reduce((s, t) => s + t.quantity, 0);
  return NextResponse.json({ ...material, onHand });
}
