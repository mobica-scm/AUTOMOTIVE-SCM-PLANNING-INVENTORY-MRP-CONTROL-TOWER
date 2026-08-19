import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({ userId: z.string().optional(), note: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await prisma.exception.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Exception not found" }, { status: 404 });

  const updated = await prisma.exception.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });

  await prisma.auditLog.create({
    data: {
      entityType: "Exception",
      entityId: id,
      action: "UPDATE",
      beforeJson: JSON.stringify(existing),
      afterJson: JSON.stringify(updated),
      userId: parsed.data.userId,
      reason: parsed.data.note ?? "Marked resolved by planner",
    },
  });

  return NextResponse.json(updated);
}
