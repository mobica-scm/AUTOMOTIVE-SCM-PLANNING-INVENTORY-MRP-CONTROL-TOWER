import { NextResponse } from "next/server";
import { runMrpForProject } from "@/lib/mrp";

// Read-only preview: recomputes the MRP grid live without writing
// anything. Used by the MRP grid screen so a planner can inspect the
// time-phased position before deciding to "Run & publish".
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");
  const horizonWeeks = searchParams.get("horizonWeeks");
  if (!projectId) return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const result = await runMrpForProject(projectId, { horizonWeeks: horizonWeeks ? parseInt(horizonWeeks, 10) : undefined });
  return NextResponse.json(result);
}
