import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourParticipant } from "@/lib/tours/auth";
import { loadTourSettings, loadToursOverview } from "@/lib/tours/server";
import { tourApiErrorCode } from "@/lib/tours/validation";
import {
  processTourWaitlistAndNotify,
  processTourWaitlistAndNotifySafely,
} from "@/lib/tours/waitlist";

export const dynamic = "force-dynamic";

function participantIdFromRequest(request: Request): string | null {
  return new URL(request.url).searchParams.get("participantId");
}

export async function GET(request: Request) {
  const auth = await requireTourParticipant(participantIdFromRequest(request));
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = createSupabaseServiceClient({ noStore: true });
    const settings = await loadTourSettings(service);
    if (!settings.publicEnabled) {
      return NextResponse.json({
        settings,
        tours: [],
        booking: null,
        waitlist: null,
        participants: auth.candidates,
        selectedParticipantId: auth.participant.id,
      });
    }

    const [bookingResult, waitlistResult] = await Promise.all([
      service
        .from("tour_bookings")
        .select("id,tour_id,booked_at,updated_at")
        .eq("participant_id", auth.participant.id)
        .maybeSingle(),
      service
        .from("tour_waitlist")
        .select("id,tour_id,status,joined_at,offered_at,offer_expires_at")
        .eq("participant_id", auth.participant.id)
        .in("status", ["waiting", "offered"])
        .order("joined_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (bookingResult.error) throw new Error(bookingResult.error.message);
    if (waitlistResult.error) throw new Error(waitlistResult.error.message);

    const bookingTourId = bookingResult.data?.tour_id
      ? String(bookingResult.data.tour_id)
      : null;
    const activeWaitlistTourId = waitlistResult.data?.tour_id
      ? String(waitlistResult.data.tour_id)
      : null;
    const allTours = await loadToursOverview({ service, includeInactive: true });
    const tours = allTours.filter(
      (tour) => tour.isActive || tour.id === bookingTourId || tour.id === activeWaitlistTourId
    );

    let waitlist = waitlistResult.data
      ? {
          id: String(waitlistResult.data.id),
          tourId: String(waitlistResult.data.tour_id),
          status: String(waitlistResult.data.status),
          joinedAt: String(waitlistResult.data.joined_at),
          offeredAt: waitlistResult.data.offered_at
            ? String(waitlistResult.data.offered_at)
            : null,
          offerExpiresAt: waitlistResult.data.offer_expires_at
            ? String(waitlistResult.data.offer_expires_at)
            : null,
          position: null as number | null,
        }
      : null;

    if (
      waitlist?.status === "offered" &&
      (!waitlist.offerExpiresAt || waitlist.offerExpiresAt <= new Date().toISOString())
    ) {
      waitlist = null;
    }
    if (waitlist) {
      const { data: queue, error: queueError } = await service
        .from("tour_waitlist")
        .select("id,joined_at,status,offer_expires_at")
        .eq("tour_id", waitlist.tourId)
        .in("status", ["waiting", "offered"])
        .order("joined_at", { ascending: true })
        .order("id", { ascending: true });
      if (queueError) throw new Error(queueError.message);
      const activeQueue = (queue ?? []).filter(
        (row) =>
          row.status === "waiting" ||
          (row.status === "offered" && String(row.offer_expires_at ?? "") > new Date().toISOString())
      );
      const index = activeQueue.findIndex((row) => String(row.id) === waitlist?.id);
      waitlist.position = index >= 0 ? index + 1 : null;
    }

    return NextResponse.json({
      settings,
      tours,
      booking: bookingResult.data
        ? {
            id: String(bookingResult.data.id),
            tourId: String(bookingResult.data.tour_id),
            bookedAt: String(bookingResult.data.booked_at),
            updatedAt: String(bookingResult.data.updated_at),
          }
        : null,
      waitlist,
      participants: auth.candidates,
      selectedParticipantId: auth.participant.id,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load tours" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "TOUR_OPERATION_FAILED" }, { status: 400 });
  }
  const participantId = String(body.participantId ?? "") || null;
  const auth = await requireTourParticipant(participantId);
  if ("errorResponse" in auth) return auth.errorResponse;

  const action = String(body.action ?? "");
  const tourId = String(body.tourId ?? "");
  const service = createSupabaseServiceClient({ noStore: true });
  try {
    if (action === "book" || action === "accept_offer") {
      if (!tourId) throw new Error("TOUR_NOT_FOUND");
      if (action === "book") {
        await processTourWaitlistAndNotify(service);
      }
      if (action === "accept_offer") {
        const { data: offer, error: offerError } = await service
          .from("tour_waitlist")
          .select("id")
          .eq("participant_id", auth.participant.id)
          .eq("tour_id", tourId)
          .eq("status", "offered")
          .gt("offer_expires_at", new Date().toISOString())
          .maybeSingle();
        if (offerError) throw new Error(offerError.message);
        if (!offer) throw new Error("TOUR_OFFER_EXPIRED");
      }
      const { error } = await service.rpc("tour_set_booking", {
        p_participant_id: auth.participant.id,
        p_tour_id: tourId,
        p_actor_user_id: auth.user.id,
        p_actor_email: auth.email,
        p_actor_role: "partecipante",
        p_enforce_participant_window: true,
      });
      if (error) throw new Error(error.message);
    } else if (action === "cancel_booking") {
      const { error } = await service.rpc("tour_remove_booking", {
        p_participant_id: auth.participant.id,
        p_actor_user_id: auth.user.id,
        p_actor_email: auth.email,
        p_actor_role: "partecipante",
        p_enforce_participant_window: true,
      });
      if (error) throw new Error(error.message);
    } else if (action === "join_waitlist") {
      if (!tourId) throw new Error("TOUR_NOT_FOUND");
      const { error } = await service.rpc("tour_join_waitlist", {
        p_participant_id: auth.participant.id,
        p_tour_id: tourId,
      });
      if (error) throw new Error(error.message);
    } else if (action === "leave_waitlist") {
      const { error } = await service.rpc("tour_leave_waitlist", {
        p_participant_id: auth.participant.id,
      });
      if (error) throw new Error(error.message);
    } else {
      return NextResponse.json({ error: "TOUR_OPERATION_FAILED" }, { status: 400 });
    }

    const waitlist = await processTourWaitlistAndNotifySafely(service);
    return NextResponse.json({ ok: true, waitlist });
  } catch (error) {
    return NextResponse.json({ error: tourApiErrorCode(error) }, { status: 409 });
  }
}
