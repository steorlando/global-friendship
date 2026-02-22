import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type GroupLeaderRow = {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  ruolo: string | null;
  telefono: string | null;
  italia: boolean | null;
  roma: boolean | null;
};

const SELECT_FIELDS = "id,email,nome,cognome,ruolo,telefono,italia,roma";

async function requireManagerContext() {
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

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (profile?.ruolo !== "manager" && profile?.ruolo !== "admin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { service };
}

export async function GET() {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { data, error } = await auth.service
    .from("profili")
    .select(SELECT_FIELDS)
    .eq("ruolo", "capogruppo")
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const groupLeaders = ((data ?? []) as GroupLeaderRow[]).sort((a, b) => {
    const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.nome ?? "").localeCompare(b.nome ?? "");
  });

  return NextResponse.json({ groupLeaders });
}
