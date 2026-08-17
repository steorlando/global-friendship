import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { loadTourSettings, loadToursOverview } from "@/lib/tours/server";
import { parseTourInput, tourApiErrorCode } from "@/lib/tours/validation";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = createSupabaseServiceClient({ noStore: true });
    const [settings, tours] = await Promise.all([
      loadTourSettings(service),
      loadToursOverview({ service, includeInactive: true }),
    ]);
    return NextResponse.json({ settings, tours, role: auth.role });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tours" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const input = parseTourInput(await request.json());
    const service = createSupabaseServiceClient({ noStore: true });
    const { data, error } = await service
      .from("tours")
      .insert({
        title: input.title,
        description: input.description,
        max_participants: input.maxParticipants,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail,
        is_active: input.isActive,
        created_by: auth.user.id,
        updated_by: auth.user.id,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: tourApiErrorCode(error) },
      { status: 400 }
    );
  }
}

export async function PATCH(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const id = String(body.id ?? "");
    if (!id) return NextResponse.json({ error: "TOUR_NOT_FOUND" }, { status: 400 });
    const input = parseTourInput(body);
    const service = createSupabaseServiceClient({ noStore: true });
    const overview = await loadToursOverview({ service, includeInactive: true });
    const existing = overview.find((tour) => tour.id === id);
    if (!existing) return NextResponse.json({ error: "TOUR_NOT_FOUND" }, { status: 404 });
    if (input.maxParticipants < existing.bookedCount + existing.heldCount) {
      return NextResponse.json({ error: "TOUR_CAPACITY_BELOW_OCCUPANCY" }, { status: 409 });
    }

    const { error } = await service
      .from("tours")
      .update({
        title: input.title,
        description: input.description,
        max_participants: input.maxParticipants,
        contact_name: input.contactName,
        contact_phone: input.contactPhone,
        contact_email: input.contactEmail,
        is_active: input.isActive,
        updated_by: auth.user.id,
      })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: tourApiErrorCode(error) },
      { status: 400 }
    );
  }
}
