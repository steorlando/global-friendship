import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { computeParticipantCalculatedFields } from "@/lib/tally/calculated-fields";
import {
  ALLOGGIO_OPTIONS,
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
} from "@/lib/partecipante/constants";

type ParticipantRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  nazione: string | null;
  email: string | null;
  telefono: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  allergie: string | null;
  esigenze_alimentari: string | null;
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string | null;
  quota_totale: number | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

const SELECT_FIELDS =
  "id,nome,cognome,nazione,email,telefono,data_nascita,data_arrivo,data_partenza,alloggio,allergie,esigenze_alimentari,disabilita_accessibilita,difficolta_accessibilita,quota_totale,gruppo_id,gruppo_label";

const alloggioSet = new Set<string>(ALLOGGIO_OPTIONS);
const esigenzeSet = new Set<string>(ESIGENZE_ALIMENTARI_OPTIONS);
const difficoltaSet = new Set<string>(DIFFICOLTA_ACCESSIBILITA_OPTIONS);

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeText(value);
  return normalized ? normalized.toLowerCase() : null;
}

function parseDateOnly(value: string | null): Date | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateIsBetween(value: string, min: string, max: string): boolean {
  return value >= min && value <= max;
}

function normalizeDifficolta(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
  return [...new Set(items)];
}

function normalizeEsigenze(value: unknown): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean);
    return [...new Set(items)];
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function parseStoredDifficolta(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && difficoltaSet.has(item));
}

function parseStoredEsigenze(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && esigenzeSet.has(item));
}

function buildGroupLabel(row: ParticipantRow): string {
  const value = (row.gruppo_label ?? row.gruppo_id ?? "").trim();
  return value || "-";
}

function participantBelongsToGroups(
  participant: ParticipantRow,
  groupIds: Set<string>
): boolean {
  const gruppoId = (participant.gruppo_id ?? "").trim();
  const gruppoLabel = (participant.gruppo_label ?? "").trim();
  return groupIds.has(gruppoId) || groupIds.has(gruppoLabel);
}

async function requireCapogruppoContext() {
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

  if (profile?.ruolo !== "capogruppo") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const { data: links, error: linksError } = await service
    .from("profili_gruppi")
    .select("gruppo_id")
    .eq("profilo_id", user.id);

  if (linksError) {
    return {
      errorResponse: NextResponse.json({ error: linksError.message }, { status: 500 }),
    };
  }

  const groups = [...new Set((links ?? []).map((row) => String(row.gruppo_id ?? "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  return { user, service, groups };
}

async function loadParticipantsForGroups(groupIds: string[]) {
  if (groupIds.length === 0) return [] as ParticipantRow[];

  const service = createSupabaseServiceClient();
  const [byGroupId, byGroupLabel] = await Promise.all([
    service.from("partecipanti").select(SELECT_FIELDS).in("gruppo_id", groupIds),
    service.from("partecipanti").select(SELECT_FIELDS).in("gruppo_label", groupIds),
  ]);

  if (byGroupId.error) {
    throw new Error(byGroupId.error.message);
  }

  if (byGroupLabel.error) {
    throw new Error(byGroupLabel.error.message);
  }

  const merged = new Map<string, ParticipantRow>();
  for (const row of [...(byGroupId.data ?? []), ...(byGroupLabel.data ?? [])]) {
    if (!row.id) continue;
    merged.set(row.id, row as ParticipantRow);
  }

  return [...merged.values()].sort((a, b) => {
    const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.nome ?? "").localeCompare(b.nome ?? "");
  });
}

function toResponseParticipant(row: ParticipantRow) {
  return {
    ...row,
    group: buildGroupLabel(row),
    esigenze_alimentari: parseStoredEsigenze(row.esigenze_alimentari),
    difficolta_accessibilita: parseStoredDifficolta(row.difficolta_accessibilita),
  };
}

export async function GET() {
  const auth = await requireCapogruppoContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const participants = await loadParticipantsForGroups(auth.groups);

    return NextResponse.json({
      groups: auth.groups,
      showGroupColumn: auth.groups.length > 1,
      participants: participants.map(toResponseParticipant),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load participants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireCapogruppoContext();
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

  const { data: participant, error: participantError } = await auth.service
    .from("partecipanti")
    .select(SELECT_FIELDS)
    .eq("id", participantId)
    .maybeSingle();

  if (participantError) {
    return NextResponse.json({ error: participantError.message }, { status: 500 });
  }

  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const groupSet = new Set(auth.groups);
  if (!participantBelongsToGroups(participant as ParticipantRow, groupSet)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const current = participant as ParticipantRow;

  const nome = "nome" in body ? normalizeText(body.nome) : normalizeText(current.nome);
  const cognome =
    "cognome" in body ? normalizeText(body.cognome) : normalizeText(current.cognome);
  const nazione = "nazione" in body ? normalizeText(body.nazione) : current.nazione;
  const email = "email" in body ? normalizeEmail(body.email) : normalizeEmail(current.email);
  const telefono =
    "telefono" in body ? normalizeText(body.telefono) : normalizeText(current.telefono);
  const dataNascita =
    "data_nascita" in body
      ? normalizeText(body.data_nascita)
      : normalizeText(current.data_nascita);
  const dataArrivo =
    "data_arrivo" in body
      ? normalizeText(body.data_arrivo)
      : normalizeText(current.data_arrivo);
  const dataPartenza =
    "data_partenza" in body
      ? normalizeText(body.data_partenza)
      : normalizeText(current.data_partenza);
  const alloggio = "alloggio" in body ? normalizeText(body.alloggio) : current.alloggio;
  const allergie = "allergie" in body ? normalizeText(body.allergie) : current.allergie;
  const esigenzeAlimentari =
    "esigenze_alimentari" in body
      ? normalizeEsigenze(body.esigenze_alimentari)
      : parseStoredEsigenze(current.esigenze_alimentari);
  const disabilitaAccessibilita =
    "disabilita_accessibilita" in body &&
    typeof body.disabilita_accessibilita === "boolean"
      ? body.disabilita_accessibilita
      : Boolean(current.disabilita_accessibilita);
  const difficoltaAccessibilita =
    "difficolta_accessibilita" in body
      ? normalizeDifficolta(body.difficolta_accessibilita)
      : parseStoredDifficolta(current.difficolta_accessibilita);

  if (!nome || !cognome) {
    return NextResponse.json(
      { error: "nome and cognome are required" },
      { status: 400 }
    );
  }

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: "email is invalid" }, { status: 400 });
  }

  if (dataNascita && !parseDateOnly(dataNascita)) {
    return NextResponse.json(
      { error: "data_nascita must be in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  if (dataArrivo && !dateIsBetween(dataArrivo, ARRIVAL_DATE_MIN, ARRIVAL_DATE_MAX)) {
    return NextResponse.json(
      {
        error: `data_arrivo must be between ${ARRIVAL_DATE_MIN} and ${ARRIVAL_DATE_MAX}`,
      },
      { status: 400 }
    );
  }

  if (
    dataPartenza &&
    !dateIsBetween(dataPartenza, DEPARTURE_DATE_MIN, DEPARTURE_DATE_MAX)
  ) {
    return NextResponse.json(
      {
        error: `data_partenza must be between ${DEPARTURE_DATE_MIN} and ${DEPARTURE_DATE_MAX}`,
      },
      { status: 400 }
    );
  }

  if (dataArrivo && dataPartenza && dataPartenza < dataArrivo) {
    return NextResponse.json(
      { error: "data_partenza must be on or after data_arrivo" },
      { status: 400 }
    );
  }

  if (alloggio && !alloggioSet.has(alloggio)) {
    return NextResponse.json({ error: "Invalid alloggio value" }, { status: 400 });
  }

  if (esigenzeAlimentari.some((item) => !esigenzeSet.has(item))) {
    return NextResponse.json(
      { error: "Invalid esigenze_alimentari value" },
      { status: 400 }
    );
  }

  if (difficoltaAccessibilita.some((item) => !difficoltaSet.has(item))) {
    return NextResponse.json(
      { error: "Invalid difficolta_accessibilita value" },
      { status: 400 }
    );
  }

  const normalizedDifficolta = disabilitaAccessibilita ? difficoltaAccessibilita : [];

  const calculated = computeParticipantCalculatedFields({
    arrival: parseDateOnly(dataArrivo),
    departure: parseDateOnly(dataPartenza),
    dataNascita,
  });

  const { data: updated, error: updateError } = await auth.service
    .from("partecipanti")
    .update({
      nome,
      cognome,
      nazione,
      email,
      telefono,
      data_nascita: dataNascita,
      data_arrivo: dataArrivo,
      data_partenza: dataPartenza,
      alloggio,
      allergie,
      esigenze_alimentari:
        esigenzeAlimentari.length > 0 ? esigenzeAlimentari.join(", ") : null,
      disabilita_accessibilita: disabilitaAccessibilita,
      difficolta_accessibilita:
        normalizedDifficolta.length > 0 ? normalizedDifficolta.join(", ") : null,
      giorni_permanenza: calculated.giorniPermanenza,
      quota_totale: calculated.quotaTotale,
      eta: calculated.eta,
      is_minorenne: calculated.isMinorenne,
    })
    .eq("id", participantId)
    .select(SELECT_FIELDS)
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, participant: toResponseParticipant(updated as ParticipantRow) });
}
