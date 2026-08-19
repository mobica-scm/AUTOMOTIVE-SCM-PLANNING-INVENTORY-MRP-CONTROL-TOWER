import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { CandidateForecastLine } from "@/lib/forecastParser";
import { requireRole, isSessionPayload } from "@/lib/permissions";

const bodySchema = z.object({
  stagingId: z.string(),
  accountId: z.string(),
  notes: z.string().optional(),
  // The planner may have edited variant codes / dropped rows in the UI
  // before confirming — if provided, this replaces the staged lines.
  lines: z
    .array(
      z.object({
        variantCode: z.string(),
        periodLabel: z.string(),
        periodStart: z.string(),
        lotRef: z.string().optional(),
        quantityKits: z.number(),
      })
    )
    .optional(),
});

// Confirm -> create a new, immutable ForecastVersion. Never overwrites
// a prior version (Section 7 of the blueprint) — versionNumber always
// increments per project.
export async function POST(req: Request) {
  const actorOrError = requireRole(req, ["PLANNER", "MANAGER", "ADMIN"]);
  if (!isSessionPayload(actorOrError)) return actorOrError;
  const uploadedById = actorOrError.sub;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const { stagingId, accountId, notes } = parsed.data;

  const staging = await prisma.forecastStaging.findUnique({ where: { id: stagingId } });
  if (!staging) return NextResponse.json({ error: "Staged upload not found or already confirmed" }, { status: 404 });

  const lines: CandidateForecastLine[] = parsed.data.lines ?? JSON.parse(staging.payloadJson).candidateLines;
  if (!lines.length) return NextResponse.json({ error: "No forecast lines to confirm" }, { status: 400 });

  const last = await prisma.forecastVersion.findFirst({
    where: { projectId: staging.projectId },
    orderBy: { versionNumber: "desc" },
  });
  const nextVersion = (last?.versionNumber ?? 0) + 1;

  const version = await prisma.$transaction(async (tx) => {
    if (last) await tx.forecastVersion.update({ where: { id: last.id }, data: { status: "SUPERSEDED" } });

    const created = await tx.forecastVersion.create({
      data: {
        accountId,
        projectId: staging.projectId,
        versionNumber: nextVersion,
        sourceFileName: staging.sourceFileName,
        templateName: staging.detectedLayout,
        uploadedById,
        status: "CONFIRMED",
        notes,
        lines: {
          create: lines.map((l) => ({
            variantCode: l.variantCode,
            periodStart: new Date(l.periodStart),
            periodLabel: l.periodLabel,
            lotRef: l.lotRef,
            quantityKits: l.quantityKits,
          })),
        },
      },
      include: { lines: true },
    });

    await tx.forecastStaging.delete({ where: { id: stagingId } });

    await tx.auditLog.create({
      data: {
        entityType: "ForecastVersion",
        entityId: created.id,
        action: "CREATE",
        afterJson: JSON.stringify({ versionNumber: nextVersion, lineCount: lines.length, sourceFileName: staging.sourceFileName }),
        userId: uploadedById,
        reason: "Forecast confirmed by planner after mapping review",
      },
    });

    return created;
  });

  return NextResponse.json(version, { status: 201 });
}
