import "server-only";

import { NextResponse } from "next/server";
import {
  canGenerateParticipationReport,
  type ParticipationReportAccessProfile,
} from "@/lib/statistics/participation-report-access";
import type { ParticipationParticipant } from "@/lib/statistics/participation-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const PAGE_SIZE = 500;

export async function requireParticipationReportAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const service = createSupabaseServiceClient({ noStore: true });
  const { data: profiles, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .eq("ruolo", "admin")
    .limit(1);

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }
  if (
    !canGenerateParticipationReport(
      (profiles ?? []) as ParticipationReportAccessProfile[],
    )
  ) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { service };
}

export async function loadParticipationReportParticipants(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<ParticipationParticipant[]> {
  const participants: ParticipationParticipant[] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await service
      .from("partecipanti")
      .select(
        "id,nome,cognome,tipo_iscrizione,paese_residenza,nazione,citta:città,gruppo_label,gruppo_id",
      )
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw new Error(error.message);

    const page = (data ?? []) as unknown as ParticipationParticipant[];
    participants.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return participants;
}
