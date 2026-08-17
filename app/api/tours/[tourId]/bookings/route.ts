import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tourId: string }> }
) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { tourId } = await params;
  const service = createSupabaseServiceClient({ noStore: true });
  const { data: bookingRows, error: bookingsError } = await service
    .from("tour_bookings")
    .select("participant_id,booked_at")
    .eq("tour_id", tourId)
    .order("booked_at", { ascending: true });
  if (bookingsError) {
    return NextResponse.json({ error: bookingsError.message }, { status: 500 });
  }

  const participantIds = (bookingRows ?? []).map((row) => String(row.participant_id));
  if (participantIds.length === 0) return NextResponse.json({ participants: [] });
  const { data, error } = await service
    .from("partecipanti")
    .select("id,nome,cognome,email,telefono,gruppo_id,gruppo_label")
    .in("id", participantIds)
    .is("deleted_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const order = new Map(participantIds.map((id, index) => [id, index]));
  const participants = (data ?? [])
    .map((row) => ({
      id: String(row.id),
      firstName: String(row.nome ?? ""),
      lastName: String(row.cognome ?? ""),
      email: String(row.email ?? ""),
      phone: String(row.telefono ?? ""),
      group: String(row.gruppo_label ?? row.gruppo_id ?? ""),
    }))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return NextResponse.json({ participants });
}
