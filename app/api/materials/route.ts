import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const materials = await prisma.material.findMany({
    include: {
      inventoryTxns: true,
      supplierMaterials: { include: { supplierPlant: { include: { supplierCompany: true } } } },
      bomLines: true,
    },
    orderBy: { internalRef: "asc" },
  });

  const shaped = materials.map((m) => {
    const onHand = m.inventoryTxns.reduce((s, t) => s + t.quantity, 0);
    const primary = m.supplierMaterials.find((sm) => sm.isPrimary) ?? m.supplierMaterials[0];
    return {
      id: m.id,
      internalRef: m.internalRef,
      supplierPartNo: m.supplierPartNo,
      descriptionEn: m.descriptionEn,
      descriptionAr: m.descriptionAr,
      uom: m.uom,
      moq: m.moq,
      orderMultiple: m.orderMultiple,
      safetyStock: m.safetyStock,
      criticality: m.criticality,
      onHand,
      supplierPlantName: primary?.supplierPlant.plantName ?? null,
      supplierCompanyName: primary?.supplierPlant.supplierCompany.name ?? null,
      usedInProjects: m.bomLines.length,
    };
  });

  return NextResponse.json(shaped);
}
