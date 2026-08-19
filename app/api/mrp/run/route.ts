import { NextResponse } from "next/server";
import { z } from "zod";
import { runAndPersistMrp } from "@/lib/planning";
import { requireRole, isSessionPayload } from "@/lib/permissions";

const bodySchema = z.object({ projectId: z.string(), horizonWeeks: z.number().min(1).max(78).optional() });

// Runs the engine AND persists it: replaces SUGGESTED planned orders and
// refreshes open shortage exceptions for every material in the project's
// BOM. This is the explicit, planner-triggered action — the engine never
// writes silently in the background.
export async function POST(req: Request) {
  const actorOrError = requireRole(req, ["PLANNER", "MANAGER", "ADMIN"]);
  if (!isSessionPayload(actorOrError)) return actorOrError;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const result = await runAndPersistMrp(parsed.data.projectId, { horizonWeeks: parsed.data.horizonWeeks, actorId: actorOrError.sub });
  return NextResponse.json(result);
}
