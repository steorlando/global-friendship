import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { buildParticipantBadgesPdf } from "@/lib/statistics/participant-badges";
import {
  loadParticipantBadgeRows,
  requireParticipantBadgesManagerOrAdmin,
} from "@/lib/statistics/participant-badges-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const BADGE_BACKGROUND_PATH = path.join(
  process.cwd(),
  "data",
  "badges",
  "badge-v3-print-background.jpg",
);
const BADGE_FONT_PATH = path.join(
  process.cwd(),
  "node_modules",
  "dejavu-fonts-ttf",
  "ttf",
  "DejaVuSansCondensed-Bold.ttf",
);

export async function GET() {
  const auth = await requireParticipantBadgesManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const [participants, backgroundJpeg, fontTtf] = await Promise.all([
      loadParticipantBadgeRows(auth.service),
      readFile(BADGE_BACKGROUND_PATH),
      readFile(BADGE_FONT_PATH),
    ]);
    const pdf = buildParticipantBadgesPdf({
      participants,
      backgroundJpeg,
      fontTtf,
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
        "Content-Disposition": `attachment; filename="badge-partecipanti-global-friendship-${dateStamp}.pdf"`,
        "Cache-Control": "private, no-store",
        "X-Participant-Count": String(participants.length),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unable to generate participant badges";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
