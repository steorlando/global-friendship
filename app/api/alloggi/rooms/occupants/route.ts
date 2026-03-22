import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import { loadAccommodationRoomOccupants } from "@/lib/alloggi/inventory";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const roomId = normalizeText(url.searchParams.get("roomId"));
  if (!roomId) {
    return NextResponse.json({ error: "roomId is required" }, { status: 400 });
  }

  try {
    const occupants = await loadAccommodationRoomOccupants(auth.service, roomId);
    return NextResponse.json({ occupants });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
