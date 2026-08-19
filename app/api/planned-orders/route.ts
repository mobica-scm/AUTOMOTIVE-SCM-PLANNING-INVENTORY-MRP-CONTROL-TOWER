import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const orders = await prisma.plannedOrder.findMany({
    where: status ? { status } : undefined,
    include: { material: true, supplierPlant: { include: { supplierCompany: true } }, decidedBy: true },
    orderBy: { needDate: "asc" },
  });
  return NextResponse.json(orders);
}
