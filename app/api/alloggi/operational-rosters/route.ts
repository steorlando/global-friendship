import { NextRequest, NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import { loadAccommodationOperationalRosters } from "@/lib/alloggi/operations";

export async function GET(request: NextRequest) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const rosters = await loadAccommodationOperationalRosters(auth.service, {
      includeCheckInDocuments:
        request.nextUrl.searchParams.get("includeCheckInDocuments") === "1",
    });

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
