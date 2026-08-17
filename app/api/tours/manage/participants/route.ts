import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { processTourWaitlistAndNotifySafely } from "@/lib/tours/waitlist";
import { tourApiErrorCode } from "@/lib/tours/validation";

export const dynamic = "force-dynamic";

function safeSearchTerm(value: string): string {
  return value.replace(/[,()%]/g, " ").trim().slice(0, 120);
}

export async function GET(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const url = new URL(request.url);
    const search = safeSearchTerm(url.searchParams.get("search") ?? "");
    const status = url.searchParams.get("status") === "all" ? "all" : "unbooked";
    const service = createSupabaseServiceClient({ noStore: true });

    let participantsQuery = service
      .from("partecipanti")
      .select("id,nome,cognome,email,telefono,gruppo_id,gruppo_label")
      .is("deleted_at", null)
      .order("cognome", { ascending: true })
      .order("nome", { ascending: true })
      .limit(200);
    if (search) {
      participantsQuery = participantsQuery.or(
        `nome.ilike.%${search}%,cognome.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%,gruppo_label.ilike.%${search}%`
      );
    }

    const [participantsResult, bookingsResult] = await Promise.all([
      participantsQuery,
      service.from("tour_bookings").select("participant_id,tour_id"),
    ]);
    if (participantsResult.error) throw new Error(participantsResult.error.message);
    if (bookingsResult.error) throw new Error(bookingsResult.error.message);

    const bookingByParticipant = new Map(
      (bookingsResult.data ?? []).map((row) => [String(row.participant_id), String(row.tour_id)])
    );
    const participants = (participantsResult.data ?? [])
      .map((row) => ({
        id: String(row.id),
        firstName: String(row.nome ?? ""),
        lastName: String(row.cognome ?? ""),
        email: String(row.email ?? ""),
        phone: String(row.telefono ?? ""),
        group: String(row.gruppo_label ?? row.gruppo_id ?? ""),
        tourId: bookingByParticipant.get(String(row.id)) ?? null,
      }))
      .filter((participant) => status === "all" || !participant.tourId);

    return NextResponse.json({ participants });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load participants" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const participantId = String(body.participantId ?? "");
    const tourId = String(body.tourId ?? "");
    if (!participantId || !tourId) throw new Error("TOUR_NOT_FOUND");
    const service = createSupabaseServiceClient({ noStore: true });
    const { error } = await service.rpc("tour_set_booking", {
      p_participant_id: participantId,
      p_tour_id: tourId,
      p_actor_user_id: auth.user.id,
      p_actor_email: auth.email,
      p_actor_role: auth.role,
      p_enforce_participant_window: false,
    });
    if (error) throw new Error(error.message);
    const waitlist = await processTourWaitlistAndNotifySafely(service);
    return NextResponse.json({ ok: true, waitlist });
  } catch (error) {
    return NextResponse.json({ error: tourApiErrorCode(error) }, { status: 409 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const participantId = String(body.participantId ?? "");
    if (!participantId) throw new Error("PARTICIPANT_NOT_FOUND");
    const service = createSupabaseServiceClient({ noStore: true });
    const { error } = await service.rpc("tour_remove_booking", {
      p_participant_id: participantId,
      p_actor_user_id: auth.user.id,
      p_actor_email: auth.email,
      p_actor_role: auth.role,
      p_enforce_participant_window: false,
    });
    if (error) throw new Error(error.message);
    const waitlist = await processTourWaitlistAndNotifySafely(service);
    return NextResponse.json({ ok: true, waitlist });
  } catch (error) {
    return NextResponse.json({ error: tourApiErrorCode(error) }, { status: 409 });
  }
}
