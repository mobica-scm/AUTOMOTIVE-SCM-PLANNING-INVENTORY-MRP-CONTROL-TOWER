import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  const exceptions = await prisma.exception.findMany({
    where: status ? { status } : undefined,
    include: { material: true, plannedOrder: true },
    orderBy: [{ severity: "desc" }, { dueDate: "asc" }],
  });
  return NextResponse.json(exceptions);
}
