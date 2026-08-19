import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

const bodySchema = z.object({ note: z.string().optional() });

// Any authenticated role can resolve an exception — it's an
// acknowledgement, not an approval authority. requireRole isn't used
// here on purpose; middleware already guarantees a session exists.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = getSessionUser(req);
  if (!actor) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

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
      userId: actor.sub,
      reason: parsed.data.note ?? `Marked resolved by ${actor.name}`,
    },
  });

  return NextResponse.json(updated);
}
