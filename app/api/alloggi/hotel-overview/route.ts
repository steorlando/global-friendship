import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import { loadAccommodationHotelOverview } from "@/lib/alloggi/hotel-overview";

export async function GET() {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const overview = await loadAccommodationHotelOverview(auth.service);

    return NextResponse.json({
      ...overview,
      actorRole: auth.profile.ruolo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
