import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { alloggioLongToShort } from "@/lib/partecipante/constants";
import { requireStaffAvailabilityManagerOrAdmin } from "@/lib/statistics/staff-availability-server";

type DeletedParticipantRow = {
  id: string;
  created_at: string | null;
  deleted_at: string | null;
  deleted_by_email: string | null;
  deleted_by_role: string | null;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  citta: string | null;
  paese_residenza: string | null;
  tipo_iscrizione: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

type StayDateChangeRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  previous_data_arrivo: string | null;
  previous_data_partenza: string | null;
  stay_dates_changed_at: string | null;
  stay_dates_changed_by_email: string | null;
  stay_dates_changed_by_role: string | null;
};

const SELECT_FIELDS_BASE =
  "id,created_at,deleted_at,deleted_by_email,deleted_by_role,nome,cognome,email,paese_residenza,tipo_iscrizione,alloggio,alloggio_short,gruppo_id,gruppo_label";
const SELECT_FIELDS_WITH_CITY = `${SELECT_FIELDS_BASE},citta:città`;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function canFallbackMissingColumn(error: { code?: string | null; message?: string | null }) {
  const code = error.code ?? "";
  const message = (error.message ?? "").toLowerCase();
  return (
    ["42703", "PGRST100", "PGRST204"].includes(code) ||
    message.includes("column") ||
    message.includes("parse")
  );
}

function toResponseParticipant(row: DeletedParticipantRow) {
  return {
    ...row,
    alloggio: row.alloggio_short ?? alloggioLongToShort(row.alloggio),
    group: (row.gruppo_label ?? row.gruppo_id ?? "").trim() || "-",
  };
}

export async function GET() {
  const auth = await requireStaffAvailabilityManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  const service = auth.service;
  const executeSelect = async (selectFields: string) =>
    service
      .from("partecipanti")
      .select(selectFields)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false });

  let { data, error } = await executeSelect(SELECT_FIELDS_WITH_CITY);
  if (error && canFallbackMissingColumn(error)) {
    const fallback = await executeSelect(SELECT_FIELDS_BASE);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const recentThreshold = new Date();
  recentThreshold.setUTCDate(recentThreshold.getUTCDate() - 30);
  const stayDateResult = await service
    .from("partecipanti")
    .select(
      "id,nome,cognome,email,gruppo_id,gruppo_label,data_arrivo,data_partenza,previous_data_arrivo,previous_data_partenza,stay_dates_changed_at,stay_dates_changed_by_email,stay_dates_changed_by_role"
    )
    .is("deleted_at", null)
    .gte("stay_dates_changed_at", recentThreshold.toISOString())
    .order("stay_dates_changed_at", { ascending: false });

  let stayDateChanges: StayDateChangeRow[] = [];
  if (!stayDateResult.error) {
    stayDateChanges = (stayDateResult.data ?? []) as unknown as StayDateChangeRow[];
  } else if (!canFallbackMissingColumn(stayDateResult.error)) {
    return NextResponse.json({ error: stayDateResult.error.message }, { status: 500 });
  }

  return NextResponse.json({
    participants: ((data ?? []) as unknown as DeletedParticipantRow[]).map(toResponseParticipant),
    stayDateChanges: stayDateChanges.map((row) => ({
      ...row,
      group: (row.gruppo_label ?? row.gruppo_id ?? "").trim() || "-",
    })),
    recentDays: 30,
  });
}

export async function PATCH(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = normalizeText(body.id);
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("partecipanti")
    .update({
      deleted_at: null,
      deleted_by: null,
      deleted_by_email: null,
      deleted_by_role: null,
      restored_at: new Date().toISOString(),
      restored_by: auth.user.id,
    })
    .eq("id", id)
    .not("deleted_at", "is", null)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Deleted participant not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, id });
}
