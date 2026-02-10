import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function verifySignature(rawBody: string, signatureHeader: string | null) {
  const secret = process.env.TALLY_WEBHOOK_SECRET;
  if (!secret) return true;

  if (!signatureHeader) return false;

  const cleaned = signatureHeader.startsWith("sha256=")
    ? signatureHeader.slice("sha256=".length)
    : signatureHeader;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(cleaned);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function normalize(value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).trim();
}

function parseDate(value: string | undefined | null) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function parseArrivalDeparture(answers: Record<string, string>) {
  const range =
    answers["Date of arrival and departure"] ||
    answers["Date of arrival and departure "] ||
    "";
  const explicitDeparture = answers["Departure"] || "";

  let arrival: Date | null = null;
  let departure: Date | null = null;

  if (range) {
    const parts = range.split(/\s*-\s*|\s+to\s+/i).map((p) => p.trim());
    if (parts.length >= 2) {
      arrival = parseDate(parts[0]);
      departure = parseDate(parts[1]);
    }
  }

  if (!departure && explicitDeparture) {
    departure = parseDate(explicitDeparture);
  }

  return { arrival, departure };
}

function calcNights(arrival: Date | null, departure: Date | null) {
  if (!arrival || !departure) return null;
  const ms = departure.getTime() - arrival.getTime();
  if (ms <= 0) return null;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function extractAnswers(payload: any) {
  const answers: Record<string, string> = {};

  const fields = payload?.data?.fields ?? payload?.fields;
  if (Array.isArray(fields)) {
    for (const field of fields) {
      const label = normalize(field?.label || field?.name || field?.key);
      const value = normalize(field?.value);
      if (label) {
        answers[label] = value;
      }
    }
  }

  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!(key in answers)) {
      answers[key] = normalize(value);
    }
  }

  return answers;
}

function looksLikeUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

async function resolveGruppoId(supabase: any, rawValue: string) {
  const value = rawValue.trim();
  if (!value) return null;

  const { data: byId, error: byIdError } = await supabase
    .from("gruppi")
    .select("id")
    .eq("id", value)
    .maybeSingle();

  if (byId?.id) return byId.id;
  if (byIdError && byIdError.code !== "PGRST116") {
    console.error("Group lookup by id failed", byIdError);
  }

  if (looksLikeUuid(value)) {
    const { data: createdByUuid, error: createdByUuidError } = await supabase
      .from("gruppi")
      .insert({ id: value, nome: value })
      .select("id")
      .single();

    if (createdByUuid?.id) return createdByUuid.id;

    if (createdByUuidError && createdByUuidError.code !== "23505") {
      console.error("Group create by uuid failed", createdByUuidError);
    }

    const { data: recheckById } = await supabase
      .from("gruppi")
      .select("id")
      .eq("id", value)
      .maybeSingle();

    if (recheckById?.id) return recheckById.id;
  }

  const { data: byName, error: byNameError } = await supabase
    .from("gruppi")
    .select("id")
    .ilike("nome", value)
    .limit(1)
    .maybeSingle();

  if (byName?.id) return byName.id;
  if (byNameError && byNameError.code !== "PGRST116") {
    console.error("Group lookup by name failed", byNameError);
  }

  const { data: createdByName, error: createdByNameError } = await supabase
    .from("gruppi")
    .insert({ nome: value })
    .select("id")
    .single();

  if (createdByName?.id) return createdByName.id;

  if (createdByNameError && createdByNameError.code !== "23505") {
    console.error("Group create by name failed", createdByNameError);
  }

  const { data: recheckByName } = await supabase
    .from("gruppi")
    .select("id")
    .ilike("nome", value)
    .limit(1)
    .maybeSingle();

  if (recheckByName?.id) return recheckByName.id;

  console.warn("Unable to resolve gruppo_id. Using null.", { value });
  return null;
}

async function handlePost(req: Request) {
  const rawBody = await req.text();
  const signatureHeader =
    req.headers.get("tally-signature") ||
    req.headers.get("x-tally-signature") ||
    req.headers.get("tally-signature-v1");

  if (!verifySignature(rawBody, signatureHeader)) {
    console.warn("Invalid signature", { signatureHeader });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const answers = extractAnswers(payload);

  const nome =
    answers["Name/Nome/Nombre/Prenom"] ||
    answers["Nome"] ||
    answers["Name"] ||
    "";
  const cognome =
    answers["Surname / Cognome / Apellido / Nom de famille"] ||
    answers["Cognome"] ||
    answers["Surname"] ||
    "";
  const email =
    answers["e-mail"] ||
    answers["Email"] ||
    answers["email"] ||
    "";
  const nazione =
    answers["Nationality/Nazionalità/Nacionalidad/Nationalitè"] ||
    answers["Nationality"] ||
    "";
  const paeseResidenza =
    answers[
      "Country of residence / Paese di residenza / País de residencia / Pays de résidence"
    ] || "";
  const citta = answers["City"] || answers["Città"] || "";
  const gruppoRoma = answers["Gruppo di Roma"] || "";

  const gruppoKey =
    citta.toLowerCase() === "roma"
      ? gruppoRoma
      : paeseResidenza.toLowerCase() === "italy" ||
          paeseResidenza.toLowerCase() === "italia"
        ? citta
        : paeseResidenza;

  const { arrival, departure } = parseArrivalDeparture(answers);
  const nights = calcNights(arrival, departure);
  const quotaTotale = nights === null ? null : nights >= 4 ? 235 : 200;

  if (!email || !nome || !cognome) {
    return NextResponse.json(
      { error: "Missing required fields (nome, cognome, email)" },
      { status: 400 }
    );
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY")
  );

  const { data: existing, error: existingError } = await supabase
    .from("partecipanti")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("Supabase pre-check error", existingError);
    return NextResponse.json({ error: existingError.message }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({ ok: true, skipped: "email_exists" });
  }

  const gruppoId = await resolveGruppoId(supabase, gruppoKey || "");

  const { error } = await supabase.from("partecipanti").insert({
    nome,
    cognome,
    email,
    nazione: nazione || null,
    "città": citta || null,
    gruppo_id: gruppoId,
    giorni_permanenza: nights ?? undefined,
    quota_totale: quotaTotale ?? undefined,
    dati_tally: payload,
  });

  if (error) {
    console.error("Supabase insert error", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, gruppo_id: gruppoId });
}

export async function POST(req: Request) {
  try {
    return await handlePost(req);
  } catch (error) {
    console.error("Tally webhook error", error);
    return NextResponse.json(
      { error: (error as Error)?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
