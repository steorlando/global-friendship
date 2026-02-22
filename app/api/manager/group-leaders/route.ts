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

type ProfileGroupRow = {
  profilo_id: string | null;
  gruppo_id: string | null;
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

  const leaderIds = groupLeaders.map((leader) => leader.id);
  const groupsByLeader = new Map<string, string[]>();

  if (leaderIds.length > 0) {
    const { data: profileGroups, error: groupsError } = await auth.service
      .from("profili_gruppi")
      .select("profilo_id,gruppo_id")
      .in("profilo_id", leaderIds);

    if (groupsError) {
      return NextResponse.json({ error: groupsError.message }, { status: 500 });
    }

    for (const row of (profileGroups ?? []) as ProfileGroupRow[]) {
      const profileId = (row.profilo_id ?? "").trim();
      const groupId = (row.gruppo_id ?? "").trim();
      if (!profileId || !groupId) continue;

      const existing = groupsByLeader.get(profileId) ?? [];
      if (!existing.includes(groupId)) {
        existing.push(groupId);
        existing.sort((a, b) => a.localeCompare(b));
        groupsByLeader.set(profileId, existing);
      }
    }
  }

  return NextResponse.json({
    groupLeaders: groupLeaders.map((leader) => ({
      ...leader,
      gruppi: groupsByLeader.get(leader.id) ?? [],
    })),
  });
}
