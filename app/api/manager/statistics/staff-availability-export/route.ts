import { NextResponse } from "next/server";
import { buildStaffAvailabilityWorkbook } from "@/lib/statistics/staff-availability-export";
import {
  loadStaffAvailabilityRows,
  requireStaffAvailabilityManagerOrAdmin,
} from "@/lib/statistics/staff-availability-server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireStaffAvailabilityManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let rows;
  try {
    rows = await loadStaffAvailabilityRows(auth.service);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load availability";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const file = buildStaffAvailabilityWorkbook(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="disponibilita-staff-${dateStamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
