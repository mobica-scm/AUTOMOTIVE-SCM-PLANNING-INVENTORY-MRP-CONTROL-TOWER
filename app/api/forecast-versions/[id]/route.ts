import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const version = await prisma.forecastVersion.findUnique({
    where: { id },
    include: { account: true, project: true, uploadedBy: true, lines: { orderBy: { periodStart: "asc" } } },
  });
  if (!version) return NextResponse.json({ error: "Forecast version not found" }, { status: 404 });
  return NextResponse.json(version);
}
