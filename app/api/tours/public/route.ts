import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadTourSettings, loadToursOverview } from "@/lib/tours/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const service = createSupabaseServiceClient({ noStore: true });
    const settings = await loadTourSettings(service);
    const tours = settings.publicEnabled
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
