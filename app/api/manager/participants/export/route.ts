import { NextResponse } from "next/server";
import { buildParticipantListWorkbook } from "@/lib/participants/participants-export";
import { loadParticipantListExportRows } from "@/lib/participants/participants-export-server";
import { requireStaffAvailabilityManagerOrAdmin } from "@/lib/statistics/staff-availability-server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaffAvailabilityManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const rows = await loadParticipantListExportRows(auth.service);
    const file = buildParticipantListWorkbook(rows);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="partecipanti-registrati-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to export participants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
