import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { loadTourSettings, loadToursOverview } from "@/lib/tours/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const staffPreview = new URL(request.url).searchParams.get("preview") === "1";
  if (staffPreview) {
    const auth = await requireTourStaffUser();
    if ("errorResponse" in auth) return auth.errorResponse;
  }

  try {
    const service = createSupabaseServiceClient({ noStore: true });
    const settings = await loadTourSettings(service);
    const tours = settings.publicEnabled || staffPreview
      ? await loadToursOverview({ service, includeInactive: false })
      : [];
    return NextResponse.json({ settings, tours });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tours" },
      { status: 500 }
    );
  }
}
