import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { computeParticipantCalculatedFields } from "@/lib/tally/calculated-fields";
import {
  ARRIVAL_DATE_MAX,
  ARRIVAL_DATE_MIN,
  DEPARTURE_DATE_MAX,
  DEPARTURE_DATE_MIN,
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
  alloggioLongToShort,
  parseStoredDifficoltaAccessibilita,
  alloggioShortToLong,
} from "@/lib/partecipante/constants";

type ParticipantRow = {
  id: string;
  created_at: string | null;
  nome: string | null;
  cognome: string | null;
  citta: string | null;
  paese_residenza: string | null;
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
  alloggio_short: string | null;
  quota_totale: number | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

const SELECT_FIELDS_BASE =
  "id,created_at,nome,cognome,paese_residenza,nazione,email,telefono,data_nascita,data_arrivo,data_partenza,alloggio,alloggio_short,allergie,esigenze_alimentari,disabilita_accessibilita,difficolta_accessibilita,quota_totale,gruppo_id,gruppo_label";
const SELECT_FIELDS_WITH_CITY = `${SELECT_FIELDS_BASE},citta:città`;
const GROUP_COLUMN_MISSING_CODES = new Set(["42703", "PGRST204", "PGRST116"]);

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

const parseStoredDifficolta = parseStoredDifficoltaAccessibilita;

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

function normalizeForMatching(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function isItalyCountry(value: string | null | undefined): boolean {
  const normalized = normalizeForMatching(value);
  return normalized === "italia" || normalized === "italy";
}

function isRomeCity(value: string | null | undefined): boolean {
  return normalizeForMatching(value) === "roma" || normalizeForMatching(value) === "rome";
}

function computeGroupLabelFromLocation(args: {
  paeseResidenza: string | null;
  citta: string | null;
  gruppoRoma: string | null;
  fallback: string | null;
}): string | null {
  if (!isItalyCountry(args.paeseResidenza)) {
    return args.paeseResidenza || args.fallback;
  }

  if (isRomeCity(args.citta)) {
    return args.gruppoRoma || args.fallback;
  }

  return args.citta || args.fallback;
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

async function findGroupIdByColumn(
  service: ReturnType<typeof createSupabaseServiceClient>,
  column: string,
  value: string
): Promise<string | null> {
  const { data, error } = await service
    .from("gruppi")
    .select("id")
    .ilike(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    if (GROUP_COLUMN_MISSING_CODES.has(error.code ?? "")) {
      return null;
    }
    throw new Error(error.message);
  }

  return data?.id ?? null;
}

async function resolveGruppoId(
  service: ReturnType<typeof createSupabaseServiceClient>,
  groupLabel: string | null
): Promise<string | null> {
  const value = (groupLabel ?? "").trim();
  if (!value) return null;

  const { data: byId, error: byIdError } = await service
    .from("gruppi")
    .select("id")
    .eq("id", value)
    .maybeSingle();
  if (byIdError && !GROUP_COLUMN_MISSING_CODES.has(byIdError.code ?? "")) {
    throw new Error(byIdError.message);
  }
  if (byId?.id) return byId.id;

  const byNome = await findGroupIdByColumn(service, "nome", value);
  if (byNome) return byNome;

  const byName = await findGroupIdByColumn(service, "name", value);
  if (byName) return byName;

  const byLabel = await findGroupIdByColumn(service, "label", value);
  if (byLabel) return byLabel;

  const byGruppoLabel = await findGroupIdByColumn(service, "gruppo_label", value);
  if (byGruppoLabel) return byGruppoLabel;

  return null;
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
  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .in("ruolo", ["manager", "admin"]);

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (!profile || profile.length === 0) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { user, service };
}

async function loadAllParticipants() {
  const service = createSupabaseServiceClient();
  const executeSelect = async (selectFields: string) =>
    service
      .from("partecipanti")
      .select(selectFields)
      .order("cognome", { ascending: true })
      .order("nome", { ascending: true });

  let { data, error } = await executeSelect(SELECT_FIELDS_WITH_CITY);
  if (error) {
    if (!canFallbackMissingColumn(error)) {
      throw new Error(error.message);
    }

    const fallback = await executeSelect(SELECT_FIELDS_BASE);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as unknown as ParticipantRow[]).sort((a, b) => {
    const bySurname = (a.cognome ?? "").localeCompare(b.cognome ?? "");
    if (bySurname !== 0) return bySurname;
    return (a.nome ?? "").localeCompare(b.nome ?? "");
  });
}

async function loadAssignableGroups(
  service: ReturnType<typeof createSupabaseServiceClient>
): Promise<string[]> {
  const { data, error } = await service
    .from("profili_gruppi")
    .select("gruppo_id");

  if (error) {
    throw new Error(error.message);
  }

  return [...new Set((data ?? []).map((row) => String(row.gruppo_id ?? "").trim()))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

async function loadParticipantById(
  service: ReturnType<typeof createSupabaseServiceClient>,
  participantId: string
) {
  const executeSelect = async (selectFields: string) =>
    service
      .from("partecipanti")
      .select(selectFields)
      .eq("id", participantId)
      .maybeSingle();

  let { data, error } = await executeSelect(SELECT_FIELDS_WITH_CITY);
  if (error) {
    if (!canFallbackMissingColumn(error)) {
      throw new Error(error.message);
    }

    const fallback = await executeSelect(SELECT_FIELDS_BASE);
    data = fallback.data;
    error = fallback.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data as unknown as ParticipantRow | null) ?? null;
}

function toResponseParticipant(row: ParticipantRow) {
  const group = buildGroupLabel(row);
  return {
    ...row,
    alloggio: row.alloggio_short ?? alloggioLongToShort(row.alloggio),
    group,
    gruppo_roma: isRomeCity(row.citta) ? group : null,
    esigenze_alimentari: parseStoredEsigenze(row.esigenze_alimentari),
    difficolta_accessibilita: parseStoredDifficolta(row.difficolta_accessibilita),
  };
}

export async function GET() {
  const auth = await requireManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const [participants, assignableGroups] = await Promise.all([
      loadAllParticipants(),
      loadAssignableGroups(auth.service),
    ]);
    const groups = [
      ...new Set(participants.map((participant) => buildGroupLabel(participant))),
    ]
      .filter((group) => group && group !== "-")
      .sort((a, b) => a.localeCompare(b));

    return NextResponse.json({
      groups,
      assignableGroups,
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

  let current: ParticipantRow | null = null;
  try {
    current = await loadParticipantById(auth.service, participantId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load participant";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!current) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const nome = "nome" in body ? normalizeText(body.nome) : normalizeText(current.nome);
  const cognome =
    "cognome" in body ? normalizeText(body.cognome) : normalizeText(current.cognome);
  const nazione = "nazione" in body ? normalizeText(body.nazione) : current.nazione;
  const paeseResidenza =
    "paese_residenza" in body
      ? normalizeText(body.paese_residenza)
      : normalizeText(current.paese_residenza);
  const citta = "citta" in body ? normalizeText(body.citta) : normalizeText(current.citta);
  const fallbackGroupLabel =
    normalizeText(current.gruppo_label) ?? normalizeText(current.gruppo_id);
  const gruppoRoma =
    "gruppo_roma" in body
      ? normalizeText(body.gruppo_roma)
      : isRomeCity(citta)
        ? fallbackGroupLabel
        : null;
  const gruppoLabel = computeGroupLabelFromLocation({
    paeseResidenza,
    citta,
    gruppoRoma,
    fallback: fallbackGroupLabel,
  });
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
  const alloggioInput =
    "alloggio" in body ? normalizeText(body.alloggio) : current.alloggio_short ?? current.alloggio;
  const normalizedAlloggio = alloggioShortToLong(alloggioInput);
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

  if (isItalyCountry(paeseResidenza) && isRomeCity(citta) && !gruppoRoma) {
    return NextResponse.json(
      { error: "gruppo_roma is required when citta is Roma" },
      { status: 400 }
    );
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

  if (alloggioInput && !normalizedAlloggio) {
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
  let gruppoId: string | null = null;
  try {
    gruppoId = await resolveGruppoId(auth.service, gruppoLabel);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to resolve group";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const calculated = computeParticipantCalculatedFields({
    arrival: parseDateOnly(dataArrivo),
    departure: parseDateOnly(dataPartenza),
    dataNascita,
  });

  const { error: updateError } = await auth.service
    .from("partecipanti")
    .update({
      nome,
      cognome,
      nazione,
      "città": citta,
      paese_residenza: paeseResidenza,
      gruppo_id: gruppoId,
      gruppo_label: gruppoLabel,
      email,
      telefono,
      data_nascita: dataNascita,
      data_arrivo: dataArrivo,
      data_partenza: dataPartenza,
      alloggio: normalizedAlloggio,
      alloggio_short: alloggioLongToShort(normalizedAlloggio),
      allergie,
      esigenze_alimentari:
        esigenzeAlimentari.length > 0 ? esigenzeAlimentari.join(", ") : null,
      disabilita_accessibilita: disabilitaAccessibilita,
      difficolta_accessibilita:
        normalizedDifficolta.length > 0 ? normalizedDifficolta.join(", ") : null,
      eta: calculated.eta,
      is_minorenne: calculated.isMinorenne,
    })
    .eq("id", participantId)
    .select("id")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  let refreshed: ParticipantRow | null = null;
  try {
    refreshed = await loadParticipantById(auth.service, participantId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Participant updated but reload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    participant: toResponseParticipant((refreshed ?? current) as ParticipantRow),
  });
}

export async function DELETE(req: Request) {
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

  const { data: existing, error: existingError } = await auth.service
    .from("partecipanti")
    .select("id")
    .eq("id", participantId)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (!existing) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const { error: deleteError } = await auth.service
    .from("partecipanti")
    .delete()
    .eq("id", participantId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: participantId });
}
