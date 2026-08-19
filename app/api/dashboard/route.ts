import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [materialCount, supplierPlantCount, openExceptions, criticalExceptions, suggestedOrders, approvedOrders, exceptionsByType, exceptionsBySeverity] =
    await Promise.all([
      prisma.material.count(),
      prisma.supplierPlant.count(),
      prisma.exception.count({ where: { status: "OPEN" } }),
      prisma.exception.count({ where: { status: "OPEN", severity: "CRITICAL" } }),
      prisma.plannedOrder.count({ where: { status: "SUGGESTED" } }),
      prisma.plannedOrder.count({ where: { status: "APPROVED" } }),
      prisma.exception.groupBy({ by: ["type"], where: { status: "OPEN" }, _count: true }),
      prisma.exception.groupBy({ by: ["severity"], where: { status: "OPEN" }, _count: true }),
    ]);

  const recentAudit = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    include: { user: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json({
    materialCount,
    supplierPlantCount,
    openExceptions,
    criticalExceptions,
    suggestedOrders,
    approvedOrders,
    exceptionsByType,
    exceptionsBySeverity,
    recentAudit,
  });
}
