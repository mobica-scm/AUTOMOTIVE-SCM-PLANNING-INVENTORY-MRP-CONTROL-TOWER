import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { effectiveLeadTimeDays } from "@/lib/leadTime";

export async function GET() {
  const plants = await prisma.supplierPlant.findMany({
    include: {
      supplierCompany: true,
      leadTimeProfile: true,
      supplierMaterials: true,
    },
    orderBy: { plantName: "asc" },
  });

  const shaped = plants.map((p) => ({
    id: p.id,
    plantName: p.plantName,
    supplierCompanyName: p.supplierCompany.name,
    country: p.country,
    accountCode: p.accountCode,
    leadTime: p.leadTimeProfile,
    effectiveLeadTimeDays: p.leadTimeProfile ? effectiveLeadTimeDays(p.leadTimeProfile) : null,
    materialCount: p.supplierMaterials.length,
  }));

  return NextResponse.json(shaped);
}
