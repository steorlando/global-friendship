import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const RECEPTION_ROLES = ["accoglienza", "admin"] as const;

export type ReceptionRole = (typeof RECEPTION_ROLES)[number];

export async function requireReceptionContext() {
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
    .in("ruolo", [...RECEPTION_ROLES])
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
    profile: {
      id: String(profile.id),
      email,
      nome: profile.nome ? String(profile.nome) : null,
      cognome: profile.cognome ? String(profile.cognome) : null,
      ruolo: String(profile.ruolo) as ReceptionRole,
    },
  };
}
