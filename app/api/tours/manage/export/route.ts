import { NextResponse } from "next/server";
import {
  buildTourBookingsWorkbook,
  loadTourBookingExportRows,
} from "@/lib/tours/bookings-export";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = createSupabaseServiceClient({ noStore: true });
    const rows = await loadTourBookingExportRows(service);
    const file = buildTourBookingsWorkbook(rows);
    const dateStamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition":
          `attachment; filename="prenotazioni-tour-${dateStamp}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to export tour bookings";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
