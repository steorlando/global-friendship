import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const ACCOMMODATION_MANAGER_ROLES = ["alloggi", "admin"] as const;

export type AccommodationManagerRole =
  (typeof ACCOMMODATION_MANAGER_ROLES)[number];

type AccommodationProfileRow = {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  ruolo: AccommodationManagerRole | null;
};

export async function requireAccommodationManagerContext() {
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

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("id,email,nome,cognome,ruolo")
    .ilike("email", email)
    .in("ruolo", [...ACCOMMODATION_MANAGER_ROLES])
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile?.id || !profile.ruolo) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return {
    user,
    service,
    profile: profile as AccommodationProfileRow & {
      ruolo: AccommodationManagerRole;
    },
  };
}
