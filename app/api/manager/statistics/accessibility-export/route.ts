import { NextResponse } from "next/server";
import { buildAccessibilityWorkbook } from "@/lib/statistics/accessibility-export";
import {
  loadAccessibilityRows,
  requireAccessibilityManagerOrAdmin,
} from "@/lib/statistics/accessibility-server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAccessibilityManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let rows;
  try {
    rows = await loadAccessibilityRows(auth.service);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load accessibility data";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const file = buildAccessibilityWorkbook(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="accessibilita-partecipanti-${dateStamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
