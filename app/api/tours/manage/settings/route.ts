import { NextResponse } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { requireTourStaffUser } from "@/lib/tours/auth";
import { processTourWaitlistAndNotifySafely } from "@/lib/tours/waitlist";

export async function PATCH(request: Request) {
  const auth = await requireTourStaffUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const publicEnabled = Boolean(body.publicEnabled);
    const participantChangesEnabled = Boolean(body.participantChangesEnabled);
    const service = createSupabaseServiceClient({ noStore: true });
    const { error } = await service.rpc("tour_update_settings", {
      p_public_enabled: publicEnabled,
      p_participant_changes_enabled: participantChangesEnabled,
      p_actor_user_id: auth.user.id,
      p_actor_email: auth.email,
    });
    if (error) throw new Error(error.message);
    const waitlist = await processTourWaitlistAndNotifySafely(service);
    return NextResponse.json({
      ok: true,
      settings: { publicEnabled, participantChangesEnabled },
      waitlist,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update settings" },
      { status: 400 }
    );
  }
}
