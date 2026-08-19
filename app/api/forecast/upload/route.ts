import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { detectForecastLayout } from "@/lib/forecastParser";

// Upload -> detect -> stage. Nothing is written to ForecastLine here;
// the response is a reviewable preview the planner must confirm via
// /api/forecast/confirm (Section 5 of the blueprint's ingestion pipeline).
export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file");
  const projectId = form.get("projectId");
  const yearRaw = form.get("year");

  if (!(file instanceof File)) return NextResponse.json({ error: "A file is required" }, { status: 400 });
  if (typeof projectId !== "string") return NextResponse.json({ error: "projectId is required" }, { status: 400 });

  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) return NextResponse.json({ error: "Unknown project" }, { status: 404 });

  const year = yearRaw ? parseInt(String(yearRaw), 10) : new Date().getUTCFullYear();
  const buffer = Buffer.from(await file.arrayBuffer());

  let detection;
  try {
    detection = await detectForecastLayout(buffer, year);
  } catch (e) {
    return NextResponse.json({ error: `Could not parse this file as Excel: ${(e as Error).message}` }, { status: 400 });
  }

  const staging = await prisma.forecastStaging.create({
    data: {
      projectId,
      sourceFileName: file.name,
      detectedLayout: detection.detectedLayout,
      payloadJson: JSON.stringify(detection),
    },
  });

  return NextResponse.json({ stagingId: staging.id, ...detection });
}
