import { NextResponse } from "next/server";
import { buildFoodNeedsWorkbook } from "@/lib/statistics/food-needs-export";
import {
  loadFoodNeedsRows,
  requireFoodNeedsManagerOrAdmin,
} from "@/lib/statistics/food-needs-server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireFoodNeedsManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let rows;
  try {
    rows = await loadFoodNeedsRows(auth.service);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to load food needs data";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const file = buildFoodNeedsWorkbook(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="esigenze-alimentari-partecipanti-${dateStamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
