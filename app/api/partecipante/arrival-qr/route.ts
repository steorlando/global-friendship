import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { buildArrivalQrPayload } from "@/lib/accoglienza/arrivals";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const participantId = new URL(request.url).searchParams.get("participantId")?.trim();
  if (!participantId || !UUID_PATTERN.test(participantId)) {
    return NextResponse.json({ error: "Invalid participant id" }, { status: 400 });
  }

  const email = user.email.trim().toLowerCase();
  const service = createSupabaseServiceClient();
  const { data: participant, error: participantError } = await service
    .from("partecipanti")
    .select("id")
    .eq("id", participantId)
    .ilike("email", email)
    .is("deleted_at", null)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant?.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let { data: arrival, error: arrivalError } = await service
    .from("participant_event_arrivals")
    .select("qr_token,arrived_at")
    .eq("participant_id", participantId)
    .maybeSingle();

  if (!arrival && !arrivalError) {
    const inserted = await service
      .from("participant_event_arrivals")
      .insert({ participant_id: participantId })
      .select("qr_token,arrived_at")
      .single();
    arrival = inserted.data;
    arrivalError = inserted.error;
  }

  if (arrivalError || !arrival?.qr_token) {
    return NextResponse.json(
      { error: arrivalError?.message ?? "Unable to load QR code" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    value: buildArrivalQrPayload(String(arrival.qr_token)),
    arrivedAt: (arrival.arrived_at as string | null) ?? null,
  });
}
