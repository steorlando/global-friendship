import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const TOUR_STAFF_ROLES = ["admin", "manager", "tour_manager"] as const;
export type TourStaffRole = (typeof TOUR_STAFF_ROLES)[number];

type ParticipantCandidate = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  submitted_at_tally: string | null;
};

export async function requireTourStaffUser(): Promise<
  | { user: User; role: TourStaffRole; email: string }
  | { errorResponse: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const email = user.email.trim().toLowerCase();
  const service = createSupabaseServiceClient({ noStore: true });
  const { data, error } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .in("ruolo", [...TOUR_STAFF_ROLES]);

  if (error || !data?.length) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const roles = new Set(data.map((row) => String(row.ruolo)));
  const role = TOUR_STAFF_ROLES.find((item) => roles.has(item));
  if (!role) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { user, role, email };
}

export async function requireTourParticipant(
  participantId?: string | null
): Promise<
  | {
      user: User;
      email: string;
      participant: ParticipantCandidate;
      candidates: ParticipantCandidate[];
    }
  | { errorResponse: NextResponse }
> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const email = user.email.trim().toLowerCase();
  const service = createSupabaseServiceClient({ noStore: true });
  const { data, error } = await service
    .from("partecipanti")
    .select("id,nome,cognome,gruppo_id,gruppo_label,submitted_at_tally,deleted_at")
    .ilike("email", email)
    .is("deleted_at", null)
    .order("submitted_at_tally", { ascending: false, nullsFirst: false });

  if (error) {
    return {
      errorResponse: NextResponse.json({ error: error.message }, { status: 500 }),
    };
  }

  const candidates = (data ?? []) as ParticipantCandidate[];
  if (candidates.length === 0) {
    return {
      errorResponse: NextResponse.json(
        { error: "Participant not found", code: "PARTICIPANT_NOT_FOUND" },
        { status: 404 }
      ),
    };
  }

  if (participantId) {
    const participant = candidates.find((candidate) => candidate.id === participantId);
    if (!participant) {
      return {
        errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      };
    }
    return { user, email, participant, candidates };
  }

  if (candidates.length > 1) {
    return {
      errorResponse: NextResponse.json(
        {
          error: "Select a participant",
          code: "PARTICIPANT_SELECTION_REQUIRED",
          participants: candidates,
        },
        { status: 409 }
      ),
    };
  }

  return { user, email, participant: candidates[0], candidates };
}
