import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import {
  buildParticipationReportModel,
  buildParticipationReportPdf,
  type PreviousParticipationSnapshot,
} from "@/lib/statistics/participation-report";
import {
  loadParticipationReportParticipants,
  requireParticipationReportAdmin,
} from "@/lib/statistics/participation-report-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const PREVIOUS_SNAPSHOT_PATH = path.join(
  process.cwd(),
  "data",
  "participation-report-2025.json",
);
const FONT_DIRECTORY = path.join(
  process.cwd(),
  "node_modules",
  "dejavu-fonts-ttf",
  "ttf",
);

export async function GET() {
  const auth = await requireParticipationReportAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const [participants, snapshotJson, regularFont, boldFont] = await Promise.all([
      loadParticipationReportParticipants(auth.service),
      readFile(PREVIOUS_SNAPSHOT_PATH, "utf8"),
      readFile(path.join(FONT_DIRECTORY, "DejaVuSansCondensed.ttf")),
      readFile(path.join(FONT_DIRECTORY, "DejaVuSansCondensed-Bold.ttf")),
    ]);
    const previous = JSON.parse(snapshotJson) as PreviousParticipationSnapshot;
    const currentYear = previous.year + 1;
    const model = buildParticipationReportModel({ participants, previous });
    const pdf = buildParticipationReportPdf({
      model,
      previous,
      currentYear,
      generatedAt: new Date(),
      fonts: { regular: regularFont, bold: boldFont },
    });
    const dateStamp = new Date().toISOString().slice(0, 10);
    const body = pdf.buffer.slice(
      pdf.byteOffset,
      pdf.byteOffset + pdf.byteLength,
    ) as ArrayBuffer;

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="report-partecipazione-global-friendship-${currentYear}-${dateStamp}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Participant-Count": String(model.summary.activeWithoutDrivers),
        "X-Operator-Count": String(model.summary.operators),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Impossibile generare il report di partecipazione";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
