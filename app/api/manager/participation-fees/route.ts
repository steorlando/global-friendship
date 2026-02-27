import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { alloggioLongToShort } from "@/lib/partecipante/constants";

type ParticipantFeeRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  quota_totale: number | null;
  fee_paid: number | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

const SELECT_FIELDS =
  "id,nome,cognome,data_arrivo,data_partenza,alloggio,alloggio_short,quota_totale,fee_paid,gruppo_id,gruppo_label";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function buildGroupLabel(row: ParticipantFeeRow): string {
  const value = (row.gruppo_label ?? row.gruppo_id ?? "").trim();
  return value || "-";
}

function toResponseParticipant(row: ParticipantFeeRow) {
  return {
    ...row,
    alloggio: row.alloggio_short ?? alloggioLongToShort(row.alloggio),
    group: buildGroupLabel(row),
  };
}

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

  if (profile?.ruolo !== "manager") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, service };
}

async function loadAllParticipants(service = createSupabaseServiceClient()) {
  const { data, error } = await service
    .from("partecipanti")
    .select(SELECT_FIELDS)
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ParticipantFeeRow[]).sort((a, b) => {
    const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.nome ?? "").localeCompare(b.nome ?? "");
  });
}

export async function GET() {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const participants = await loadAllParticipants(auth.service);
    const groups = [...new Set(participants.map((participant) => buildGroupLabel(participant)))]
      .filter((group) => group && group !== "-")
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      groups,
      showGroupColumn: true,
      participants: participants.map(toResponseParticipant),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load participants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = normalizeText(body.id);
  if (!participantId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const rawFeePaid = body.fee_paid;
  let feePaid: number | null = null;

  if (rawFeePaid !== null && rawFeePaid !== undefined && rawFeePaid !== "") {
    const parsed =
      typeof rawFeePaid === "number"
        ? rawFeePaid
        : typeof rawFeePaid === "string"
          ? Number(rawFeePaid.trim())
          : Number.NaN;

    if (!Number.isFinite(parsed) || parsed < 0) {
      return NextResponse.json(
        { error: "fee_paid must be a number greater than or equal to 0" },
        { status: 400 }
      );
    }

    feePaid = Number(parsed.toFixed(2));
  }

  const { data: updated, error: updateError } = await auth.service
    .from("partecipanti")
    .update({ fee_paid: feePaid })
    .eq("id", participantId)
    .select(SELECT_FIELDS)
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    participant: toResponseParticipant(updated as ParticipantFeeRow),
  });
}

export async function POST(req: Request) {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawIds = Array.isArray(body.participantIds) ? body.participantIds : [];
  const participantIds = rawIds
    .map((value) => normalizeText(value))
    .filter((value): value is string => Boolean(value));

  if (participantIds.length === 0) {
    return NextResponse.json({ error: "participantIds is required" }, { status: 400 });
  }

  const { data: updatedRows, error: bulkError } = await auth.service.rpc(
    "manager_mark_participants_fully_paid",
    {
      participant_ids: participantIds,
      actor_id: auth.user.id,
    }
  );

  if (bulkError) {
    return NextResponse.json({ error: bulkError.message }, { status: 500 });
  }

  const updatedIds = ((updatedRows ?? []) as Array<{ id: string }>).map((row) => row.id);
  if (updatedIds.length === 0) {
    return NextResponse.json({ ok: true, participants: [] });
  }

  const { data: refreshed, error: refreshError } = await auth.service
    .from("partecipanti")
    .select(SELECT_FIELDS)
    .in("id", updatedIds);

  if (refreshError) {
    return NextResponse.json({ error: refreshError.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    participants: ((refreshed ?? []) as ParticipantFeeRow[]).map(toResponseParticipant),
  });
}
