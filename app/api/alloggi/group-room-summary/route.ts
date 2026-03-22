import { NextResponse } from "next/server";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import { loadAccommodationGroupSummaries } from "@/lib/alloggi/group-allocations";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function GET(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const groupId = normalizeText(url.searchParams.get("groupId"));

  try {
    const summaries = await loadAccommodationGroupSummaries(auth.service, { groupId });

    return NextResponse.json({
      summaries,
      actorRole: auth.profile.ruolo,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
