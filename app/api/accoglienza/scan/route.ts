import { NextResponse } from "next/server";
import { requireReceptionContext } from "@/lib/accoglienza/auth";
import { parseArrivalQrPayload } from "@/lib/accoglienza/arrivals";

export async function POST(request: Request) {
  const auth = await requireReceptionContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const token = parseArrivalQrPayload(String(body.value ?? ""));
  if (!token) {
    return NextResponse.json({ error: "QR code not recognized" }, { status: 400 });
  }

  const { data: arrival, error: arrivalError } = await auth.service
    .from("participant_event_arrivals")
    .select("participant_id,arrived_at")
    .eq("qr_token", token)
    .maybeSingle();

  if (arrivalError) {
    return NextResponse.json({ error: arrivalError.message }, { status: 500 });
  }
  if (!arrival?.participant_id) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const { data: participant, error: participantError } = await auth.service
    .from("partecipanti")
    .select("id")
    .eq("id", arrival.participant_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }
  if (!participant?.id) {
    return NextResponse.json({ error: "Participant not active" }, { status: 404 });
  }

  return NextResponse.json({
    participantId: String(participant.id),
    arrivedAt: (arrival.arrived_at as string | null) ?? null,
  });
}
