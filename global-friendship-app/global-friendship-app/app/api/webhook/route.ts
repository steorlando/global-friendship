import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

type TallyField = {
  key?: string;
  label?: string;
  value?: unknown;
};

function buildFieldMap(fields: TallyField[]) {
  const map = new Map<string, unknown>();
  for (const f of fields) {
    if (f.key) map.set(f.key.toLowerCase(), f.value);
    if (f.label) map.set(f.label.toLowerCase(), f.value);
  }
  return map;
}

function pickField(map: Map<string, unknown>, names: string[]) {
  for (const name of names) {
    const value = map.get(name.toLowerCase());
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

function normalizeString(value: unknown) {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function parseIntSafe(value: unknown, fallback: number) {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeGroupId(nazione: string, citta: string) {
  const n = nazione.toLowerCase();
  const c = citta.toLowerCase();
  if (n === "italia" && c === "roma") {
    return "Roma-1";
  }

  // Placeholder: add more routing rules here
  return null;
}

export async function POST(req: Request) {
  let payload: any;

  try {
    payload = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const fields: TallyField[] =
    payload?.data?.fields || payload?.fields || ([] as TallyField[]);

  const fieldMap = Array.isArray(fields) ? buildFieldMap(fields) : new Map();

  const nome =
    normalizeString(pickField(fieldMap, ["nome", "name", "first name"])) ||
    normalizeString(payload?.nome || payload?.name || payload?.first_name);
  const cognome =
    normalizeString(pickField(fieldMap, ["cognome", "last name", "surname"])) ||
    normalizeString(payload?.cognome || payload?.last_name);
  const email =
    normalizeString(pickField(fieldMap, ["email", "e-mail"])) ||
    normalizeString(payload?.email);
  const nazione =
    normalizeString(pickField(fieldMap, ["nazione", "country"])) ||
    normalizeString(payload?.nazione || payload?.country);
  const citta =
    normalizeString(pickField(fieldMap, ["citta", "città", "city"])) ||
    normalizeString(payload?.citta || payload?.city);
  const giorniPermanenza = parseIntSafe(
    pickField(fieldMap, [
      "giorni permanenza",
      "giorni_permanenza",
      "days",
      "stay",
    ]) ?? payload?.giorni_permanenza,
    1
  );

  if (!nome || !cognome || !email) {
    return Response.json(
      { error: "Missing required fields: nome, cognome, email" },
      { status: 400 }
    );
  }

  const gruppoId = computeGroupId(nazione, citta);
  const quotaTotale = giorniPermanenza * 45;

  if (gruppoId) {
    await supabase.from("gruppi").upsert({ id: gruppoId });
  }

  const participantRecord = {
    nome,
    cognome,
    email,
    nazione: nazione || null,
    citta: citta || null,
    giorni_permanenza: giorniPermanenza,
    quota_totale: quotaTotale,
    gruppo_id: gruppoId,
  };

  const { data: existing, error: selectError } = await supabase
    .from("partecipanti")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (selectError) {
    return Response.json(
      { error: "Database lookup failed", details: selectError.message },
      { status: 500 }
    );
  }

  const { data, error } = existing
    ? await supabase
        .from("partecipanti")
        .update(participantRecord)
        .eq("email", email)
        .select("id")
        .single()
    : await supabase
        .from("partecipanti")
        .insert(participantRecord)
        .select("id")
        .single();

  if (error) {
    return Response.json(
      { error: "Database write failed", details: error.message },
      { status: 500 }
    );
  }

  return Response.json({ ok: true, id: data?.id ?? null });
}
