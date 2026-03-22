import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import { loadAccommodationOperationalRosters } from "@/lib/alloggi/operations";

export async function GET() {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const rosters = await loadAccommodationOperationalRosters(auth.service);

    return NextResponse.json({
      ...rosters,
      actorRole: auth.profile.ruolo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
