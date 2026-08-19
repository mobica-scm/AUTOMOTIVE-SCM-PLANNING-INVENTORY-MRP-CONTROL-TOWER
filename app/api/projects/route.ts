import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const projects = await prisma.project.findMany({
    include: { account: true, variants: true, _count: { select: { bomLines: true, forecastVersions: true } } },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(projects);
}
