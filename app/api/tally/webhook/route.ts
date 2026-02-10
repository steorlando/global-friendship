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
  if (!secret) return true; // allow if not configured

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
  if (a.length != b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

function normalize(value: unknown) {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.join(", ");
  return String(value).trim();
}

function pickFirst(payload: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = payload[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return normalize(value);
    }
  }
  return "";
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
    // common formats: "2026-08-28 - 2026-08-31" or "2026-08-28 to 2026-08-31"
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

  // Tally webhook format often includes data.fields array
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

  // Sometimes payload is already a flat map
  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!(key in answers)) {
      answers[key] = normalize(value);
    }
  }

  return answers;
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signatureHeader =
    req.headers.get("tally-signature") ||
    req.headers.get("x-tally-signature") ||
    req.headers.get("tally-signature-v1");

  if (!verifySignature(rawBody, signatureHeader)) {
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
  const gruppoId =
    citta.toLowerCase() === "roma"
      ? gruppoRoma
      : paeseResidenza.toLowerCase() === "italy" ||
        paeseResidenza.toLowerCase() === "italia"
      ? citta
      : paeseResidenza;
  const { arrival, departure } = parseArrivalDeparture(answers);
  const nights = calcNights(arrival, departure);
  const quotaTotale =
    nights === null ? null : nights >= 4 ? 235 : 200;

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

  const { error } = await supabase.from("partecipanti").upsert(
    {
      nome,
      cognome,
      email,
      nazione: nazione || null,
      "città": citta || null,
      gruppo_id: gruppoId || null,
      giorni_permanenza: nights ?? undefined,
      quota_totale: quotaTotale ?? undefined,
      dati_tally: payload,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
