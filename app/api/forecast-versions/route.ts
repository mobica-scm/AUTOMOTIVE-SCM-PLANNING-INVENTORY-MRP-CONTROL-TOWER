import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId") ?? undefined;

  const versions = await prisma.forecastVersion.findMany({
    where: projectId ? { projectId } : undefined,
    include: {
      account: true,
      project: true,
      uploadedBy: { select: { id: true, name: true, role: true } },
      _count: { select: { lines: true } },
    },
    orderBy: [{ projectId: "asc" }, { versionNumber: "desc" }],
  });
  return NextResponse.json(versions);
}
