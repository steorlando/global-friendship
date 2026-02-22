import crypto from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { computeParticipantCalculatedFields } from "../../../../lib/tally/calculated-fields";
import { alloggioLongToShort } from "@/lib/partecipante/constants";

type TallyOption = {
  id?: string;
  optionId?: string;
  text?: string;
  label?: string;
  value?: unknown;
};

type TallyField = {
  key?: string;
  name?: string;
  label?: string;
  value?: unknown;
  options?: TallyOption[];
};

type NormalizedSubmission = {
  nome: string;
  cognome: string;
  email: string;
  emailSecondaria: string;
  telefono: string;
  tipoIscrizione: string;
  dataNascita: string;
  sesso: string;
  nazione: string;
  paeseResidenza: string;
  citta: string;
  gruppoRoma: string;
  groupLeader: string;
  gruppoLabel: string;
  partecipaInteroEvento: boolean | null;
  presenzaDettaglio: Record<string, unknown> | null;
  alloggio: string;
  alloggioShort: string;
  esigenzeAlimentari: string;
  allergie: string;
  disabilitaAccessibilita: boolean | null;
  difficoltaAccessibilita: string;
  tallySubmissionId: string;
  tallyRespondentId: string;
  note: string;
  privacyAccettata: boolean | null;
  submittedAtTally: string;
  dataArrivo: string;
  dataPartenza: string;
  nights: number | null;
  quotaTotale: number | null;
  eta: number | null;
  isMinorenne: boolean | null;
};

const GROUP_NAMESPACE_UUID = "6ba7b811-9dad-11d1-80b4-00c04fd430c8";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}`);
  }
  return value;
}

function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
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

function normalize(value: unknown): string {
  if (value === undefined || value === null) return "";
  if (Array.isArray(value)) return value.map(normalize).join(", ");
  return String(value).trim();
}

function parseDate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const d = new Date(trimmed);
  if (!Number.isNaN(d.getTime())) return d;
  return null;
}

function formatDateOnly(date: Date | null): string | null {
  if (!date) return null;
  return date.toISOString().slice(0, 10);
}

function parseBool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (["true", "si", "sì", "yes", "1", "on"].includes(v)) return true;
  if (["false", "no", "0", "off"].includes(v)) return false;
  return null;
}

function normalizeCountry(value: string): string {
  const normalized = normalize(value);
  if (!normalized) return "";

  const lower = normalized.toLowerCase();
  const aliasToCanonical: Record<string, string> = {
    italy: "Italy",
    italia: "Italy",
    it: "Italy",
  };

  return aliasToCanonical[lower] ?? normalized;
}

function isItaly(value: string): boolean {
  const normalized = normalize(value).toLowerCase();
  return normalized === "italy" || normalized === "italia" || normalized === "it";
}

function pickAnswer(answers: Record<string, string>, labels: string[]): string {
  for (const label of labels) {
    const value = answers[label];
    if (value !== undefined && value !== null && value.trim() !== "") {
      return value;
    }
  }
  return "";
}

function findAnswersByPrefix(
  answers: Record<string, string>,
  prefix: string
): Array<{ key: string; value: string }> {
  const normPrefix = prefix.trim().toLowerCase();
  return Object.entries(answers)
    .filter(([key]) => key.trim().toLowerCase().startsWith(normPrefix))
    .map(([key, value]) => ({ key, value }));
}

function findAnswersByContains(
  answers: Record<string, string>,
  fragments: string[]
): Array<{ key: string; value: string }> {
  const normalized = fragments.map((f) => f.trim().toLowerCase()).filter(Boolean);
  return Object.entries(answers)
    .filter(([key]) => {
      const lk = key.trim().toLowerCase();
      return normalized.some((fragment) => lk.includes(fragment));
    })
    .map(([key, value]) => ({ key, value }));
}

function pickAnswerContains(
  answers: Record<string, string>,
  fragments: string[]
): string {
  const matches = findAnswersByContains(answers, fragments);
  for (const match of matches) {
    if (match.value && match.value.trim() !== "") return match.value;
  }
  return "";
}

function collectCheckedOptions(
  answers: Record<string, string>,
  baseLabel: string,
  aliases: string[] = []
): string[] {
  const selected = new Set<string>();
  const labels = [baseLabel, ...aliases];

  for (const label of labels) {
    const direct = pickAnswer(answers, [label]);
    if (direct) {
      direct
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => selected.add(item));
    }
  }

  const prefixed = labels.flatMap((label) =>
    findAnswersByPrefix(answers, `${label} (`)
  );
  for (const { key, value } of prefixed) {
    if (parseBool(value) === true || normalize(value).toLowerCase() === "true") {
      const match = key.match(/\((.*)\)\s*$/);
      const choiceLabel = (match?.[1] ?? "").trim();
      if (choiceLabel) selected.add(choiceLabel);
    }
  }

  return Array.from(selected);
}

function buildPresenceDettaglio(
  answers: Record<string, string>
): Record<string, unknown> | null {
  const blocks = findAnswersByPrefix(answers, "When will you be present?");
  if (blocks.length === 0) return null;

  const details: Record<string, unknown> = {};
  for (const { key, value } of blocks) {
    const cleanedKey = key.replace(/^When will you be present\?\s*/i, "").trim();
    const itemKey = cleanedKey || "general";
    const boolValue = parseBool(value);
    details[itemKey] = boolValue === null ? value : boolValue;
  }

  return Object.keys(details).length > 0 ? details : null;
}

function optionId(option: TallyOption): string {
  return normalize(option.id || option.optionId);
}

function optionText(option: TallyOption, fallback: string): string {
  const valueText =
    typeof option.value === "string" ? option.value : normalize(option.value);
  return normalize(option.text || option.label || valueText || fallback);
}

function mapOptionValue(options: TallyOption[], raw: unknown): string {
  const rawNorm = normalize(raw);
  if (!rawNorm) return "";

  const match = options.find((opt) => optionId(opt) === rawNorm);
  if (match) return optionText(match, rawNorm);

  return rawNorm;
}

function extractFieldValue(field: TallyField): string {
  const options = Array.isArray(field.options) ? field.options : [];
  const raw = field.value;

  if (Array.isArray(raw)) {
    if (options.length > 0) {
      return raw.map((v) => mapOptionValue(options, v)).filter(Boolean).join(", ");
    }
    return raw.map((v) => normalize(v)).filter(Boolean).join(", ");
  }

  if (raw && typeof raw === "object") {
    const objectText = normalize((raw as Record<string, unknown>).text);
    if (objectText) return objectText;
  }

  if (options.length > 0) {
    return mapOptionValue(options, raw);
  }

  return normalize(raw);
}

function parseArrivalDeparture(answers: Record<string, string>) {
  const arrivalRaw =
    answers["Date of arrival and departure"] ||
    answers["Date of arrival and departure "] ||
    answers["Arrival"] ||
    answers["Date of arrival"] ||
    "";

  const departureRaw =
    answers["Departure"] || answers["Date of departure"] || "";

  let arrival: Date | null = null;
  let departure: Date | null = null;

  if (arrivalRaw) {
    const hasRangeSeparator = /\s+-\s+|\s+to\s+/i.test(arrivalRaw);
    if (hasRangeSeparator) {
      const parts = arrivalRaw
        .split(/\s+-\s+|\s+to\s+/i)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        arrival = parseDate(parts[0]);
        departure = parseDate(parts[1]);
      }
    } else {
      arrival = parseDate(arrivalRaw);
    }
  }

  if (!departure && departureRaw) {
    departure = parseDate(departureRaw);
  }

  return { arrival, departure };
}

function extractAnswers(payload: any): Record<string, string> {
  const answers: Record<string, string> = {};

  const fields: TallyField[] = payload?.data?.fields ?? payload?.fields ?? [];
  if (Array.isArray(fields)) {
    for (const field of fields) {
      const label = normalize(field?.label || field?.name || field?.key);
      if (!label) continue;
      answers[label] = extractFieldValue(field);
    }
  }

  for (const [key, value] of Object.entries(payload ?? {})) {
    if (!(key in answers)) answers[key] = normalize(value);
  }

  return answers;
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

function uuidToBytes(uuid: string): Buffer {
  const hex = uuid.replace(/-/g, "");
  return Buffer.from(hex, "hex");
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString("hex");
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-");
}

function uuidV5FromString(name: string, namespace: string): string {
  const nsBytes = uuidToBytes(namespace);
  const nameBytes = Buffer.from(name, "utf8");
  const hash = crypto
    .createHash("sha1")
    .update(Buffer.concat([nsBytes, nameBytes]))
    .digest();

  const out = Buffer.from(hash.subarray(0, 16));
  out[6] = (out[6] & 0x0f) | 0x50;
  out[8] = (out[8] & 0x3f) | 0x80;
  return bytesToUuid(out);
}

async function logWebhookEvent(
  supabase: any,
  entry: {
    submissionId: string;
    respondentId: string;
    email: string;
    status: string;
    errorCode?: string | null;
    errorMessage?: string | null;
    payload: any;
    normalized?: any;
  }
): Promise<void> {
  const { error } = await supabase.from("webhook_events").insert({
    source: "tally",
    event_type: "form_submission",
    submission_id: entry.submissionId || null,
    respondent_id: entry.respondentId || null,
    email: entry.email || null,
    status: entry.status,
    error_code: entry.errorCode ?? null,
    error_message: entry.errorMessage ?? null,
    payload: entry.payload,
    normalized: entry.normalized ?? null,
  });

  if (error && !["42P01", "PGRST204"].includes(error.code ?? "")) {
    console.error("Webhook event logging failed", error);
  }
}

async function findGroupByColumn(
  supabase: any,
  column: string,
  value: string
): Promise<string | null> {
  const { data, error } = await supabase
    .from("gruppi")
    .select("id")
    .ilike(column, value)
    .limit(1)
    .maybeSingle();

  if (error) {
    const code = error.code ?? "";
    if (code === "PGRST116" || code === "42703" || code === "PGRST204") {
      return null;
    }
    console.error(`Group lookup by ${column} failed`, error);
    return null;
  }

  return data?.id ?? null;
}

async function ensureGroupById(
  supabase: any,
  groupId: string,
  label: string
): Promise<string | null> {
  const payloadCandidates: Array<Record<string, unknown>> = [
    { id: groupId },
    { id: groupId, nome: label },
    { id: groupId, name: label },
    { id: groupId, label },
    { id: groupId, gruppo_label: label },
  ];

  for (const payload of payloadCandidates) {
    const { error } = await supabase
      .from("gruppi")
      .upsert(payload, { onConflict: "id" });

    if (!error) {
      const { data: byId } = await supabase
        .from("gruppi")
        .select("id")
        .eq("id", groupId)
        .maybeSingle();
      if (byId?.id) return byId.id;
      continue;
    }

    const code = error.code ?? "";
    if (["42703", "PGRST204", "23502"].includes(code)) {
      continue;
    }

    console.error("Group upsert failed", { payload, error });
  }

  const { data: finalCheck } = await supabase
    .from("gruppi")
    .select("id")
    .eq("id", groupId)
    .maybeSingle();

  return finalCheck?.id ?? null;
}

async function resolveGruppoId(supabase: any, rawValue: string): Promise<string | null> {
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

  const byNome = await findGroupByColumn(supabase, "nome", value);
  if (byNome) return byNome;

  const byName = await findGroupByColumn(supabase, "name", value);
  if (byName) return byName;

  const byLabel = await findGroupByColumn(supabase, "label", value);
  if (byLabel) return byLabel;

  const byGruppoLabel = await findGroupByColumn(supabase, "gruppo_label", value);
  if (byGruppoLabel) return byGruppoLabel;

  const deterministicId = looksLikeUuid(value)
    ? value
    : uuidV5FromString(value.toLowerCase(), GROUP_NAMESPACE_UUID);

  const ensured = await ensureGroupById(supabase, deterministicId, value);
  if (ensured) return ensured;

  console.warn("Unable to resolve gruppo_id. Using null.", { value });
  return null;
}

function normalizeSubmission(
  payload: any,
  answers: Record<string, string>
): NormalizedSubmission {
  const nome = pickAnswer(answers, ["Name/Nome/Nombre/Prenom", "Nome", "Name"]);
  const cognome = pickAnswer(answers, [
    "Surname / Cognome / Apellido / Nom de famille",
    "Cognome",
    "Surname",
  ]);
  const email = pickAnswer(answers, ["e-mail", "Email", "email"]);
  const emailSecondaria = pickAnswer(answers, ["e-mail-2", "Secondary email"]);
  const telefono = pickAnswer(answers, ["Contacts (Phone number and email)", "Phone"]);
  const tipoIscrizione = pickAnswer(answers, [
    "Type of registration / Tipo di iscrizione / Tipo de registro / Type d'inscription",
    "Type of registration",
  ]);
  const dataNascita = pickAnswer(answers, [
    "Date of birth / Data di nascita / Fecha de nacimiento / Date de naissance",
    "Date of birth",
  ]);
  const sesso = pickAnswer(answers, ["Sex / Sesso / Sexo / Sexe", "Sex"]);
  const nazione = pickAnswer(answers, [
    "Nationality/Nazionalità/Nacionalidad/Nationalitè",
    "Nationality",
  ]);
  const paeseResidenzaRaw =
    pickAnswer(answers, [
      "Country of residence / Paese di residenza / País de residencia / Pays de résidence",
      "Country of residence",
    ]) ||
    pickAnswerContains(answers, [
      "country of residence",
      "paese di residenza",
      "país de residencia",
      "pays de résidence",
    ]);
  const paeseResidenza = normalizeCountry(paeseResidenzaRaw);
  const citta = pickAnswer(answers, ["City", "Città"]);
  const gruppoRoma = pickAnswer(answers, ["Gruppo di Roma"]);
  const groupLeader = pickAnswer(answers, [
    "Who is your group leader?",
    "Group leader",
  ]);
  const partecipaInteroEvento = parseBool(
    pickAnswer(answers, [
      "Are you attending the entire event, from friday to sunday",
      "Are you attending the entire event",
    ])
  );
  const presenzaDettaglio = buildPresenceDettaglio(answers);

  const gruppoLabel =
    citta.toLowerCase() === "roma"
      ? gruppoRoma
      : isItaly(paeseResidenza)
        ? citta || gruppoRoma || paeseResidenza
        : paeseResidenza;

  const alloggio = pickAnswer(answers, [
    "Where are you staying? Dove alloggerai?",
    "Where are you staying?",
  ]);
  const alloggioShort = alloggioLongToShort(alloggio) ?? "";
  const esigenzeAlimentari = collectCheckedOptions(
    answers,
    "Do you have any particular food requirement"
  ).join(", ");
  const allergie = pickAnswer(answers, [
    "Do you have any allergies or intolerances? If yes, please specify.",
    "Allergies",
  ]);
  const disabilitaAccessibilita = parseBool(
    pickAnswer(answers, ["Do you have any disabilities or accessibility needs?"]) ||
      pickAnswerContains(answers, [
        "disabilities or accessibility needs",
        "disability",
        "accessibility needs",
        "disabilit",
        "accessibilit",
      ])
  );
  const difficoltaAccessibilita = collectCheckedOptions(
    answers,
    "Which difficulties do you experience? (Select all that apply)",
    ["A quali difficoltà partecipi", "Which difficulties do you experience"]
  ).join(", ");
  const esigenzeAlimentariFallback = pickAnswerContains(answers, [
    "food requirement",
    "esigenze alimentari",
    "alimentari",
    "dietary",
  ]);
  const note = pickAnswer(answers, [
    "Is there anything else important you would like to communicate to the organization?",
    "Notes",
  ]);

  const privacyAccettata = parseBool(
    pickAnswer(answers, [
      "Privacy (I have read and accept the privacy policy/ Ho letto e accetto l'informativa sulla privacy / He leído y acepto la política de privacidad / J'ai lu et j'accepte la politique de confidentialité)",
      "Privacy",
      "Pivacy (I have read and accept the privacy policy/ Ho letto e accetto l'informativa sulla privacy / He leído y acepto la política de privacidad / J'ai lu et j'accepte la politique de confidentialité)",
      "Pivacy",
    ])
  );

  const submittedAtTally =
    pickAnswer(answers, ["Submitted at"]) ||
    normalize(payload?.data?.createdAt || payload?.createdAt || payload?.submittedAt);

  const { arrival, departure } = parseArrivalDeparture(answers);
  const calculated = computeParticipantCalculatedFields({
    arrival,
    departure,
    dataNascita: dataNascita || null,
  });

  return {
    nome,
    cognome,
    email,
    emailSecondaria,
    telefono,
    tipoIscrizione,
    dataNascita,
    sesso,
    nazione,
    paeseResidenza,
    citta,
    gruppoRoma,
    groupLeader,
    gruppoLabel,
    partecipaInteroEvento,
    presenzaDettaglio,
    alloggio,
    alloggioShort,
    esigenzeAlimentari: esigenzeAlimentari || esigenzeAlimentariFallback,
    allergie,
    disabilitaAccessibilita,
    difficoltaAccessibilita,
    tallySubmissionId:
      pickAnswer(answers, ['\ufeff"Submission ID"', "Submission ID"]) ||
      normalize(payload?.data?.submissionId || payload?.submissionId),
    tallyRespondentId:
      pickAnswer(answers, ["Respondent ID"]) ||
      normalize(payload?.data?.respondentId || payload?.respondentId),
    note,
    privacyAccettata,
    submittedAtTally,
    dataArrivo: formatDateOnly(arrival) || "",
    dataPartenza: formatDateOnly(departure) || "",
    nights: calculated.giorniPermanenza,
    quotaTotale: calculated.quotaTotale,
    eta: calculated.eta,
    isMinorenne: calculated.isMinorenne,
  };
}

async function handlePost(req: Request) {
  const rawBody = await req.text();
  let payload: any = { raw: rawBody };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = createClient(
    getEnv("SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY")
  );
  const webhookSecret = process.env.TALLY_WEBHOOK_SECRET?.trim() ?? "";
  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Server webhook secret is not configured" },
      { status: 500 }
    );
  }

  const signatureHeader =
    req.headers.get("tally-signature") ||
    req.headers.get("x-tally-signature") ||
    req.headers.get("tally-signature-v1");

  if (!verifySignature(rawBody, signatureHeader, webhookSecret)) {
    await logWebhookEvent(supabase, {
      submissionId: normalize(payload?.data?.submissionId || payload?.submissionId),
      respondentId: normalize(payload?.data?.respondentId || payload?.respondentId),
      email: normalize(payload?.["e-mail"] || payload?.email),
      status: "invalid_signature",
      errorCode: "401",
      errorMessage: "Invalid signature",
      payload,
    });

    console.warn("Invalid signature", { signatureHeader });
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const answers = extractAnswers(payload);
  const normalized = normalizeSubmission(payload, answers);

  const submissionId =
    normalize(payload?.data?.submissionId || payload?.submissionId) ||
    normalize(payload?.["Submission ID"]) ||
    normalize(payload?.['\ufeff"Submission ID"']) ||
    normalize(answers['\ufeff"Submission ID"']) ||
    normalize(answers["Submission ID"]);
  const respondentId =
    normalize(payload?.data?.respondentId || payload?.respondentId) ||
    normalize(payload?.["Respondent ID"]) ||
    normalize(answers["Respondent ID"]);

  if (!normalized.email || !normalized.nome || !normalized.cognome) {
    await logWebhookEvent(supabase, {
      submissionId,
      respondentId,
      email: normalized.email,
      status: "rejected_missing_fields",
      errorCode: "400",
      errorMessage: "Missing required fields (nome, cognome, email)",
      payload,
      normalized,
    });

    return NextResponse.json(
      { error: "Missing required fields (nome, cognome, email)" },
      { status: 400 }
    );
  }

  const gruppoId = await resolveGruppoId(supabase, normalized.gruppoLabel);
  const submittedAtIso = parseDate(normalized.submittedAtTally)?.toISOString() || null;

  const fullInsert = {
    nome: normalized.nome,
    cognome: normalized.cognome,
    email: normalized.email,
    nazione: normalized.nazione || null,
    "città": normalized.citta || null,
    giorni_permanenza: normalized.nights ?? undefined,
    quota_totale: normalized.quotaTotale ?? undefined,
    gruppo_id: gruppoId,
    telefono: normalized.telefono || null,
    email_secondaria: normalized.emailSecondaria || null,
    paese_residenza: normalized.paeseResidenza || null,
    tipo_iscrizione: normalized.tipoIscrizione || null,
    sesso: normalized.sesso || null,
    data_nascita: normalized.dataNascita || null,
    data_arrivo: normalized.dataArrivo || null,
    data_partenza: normalized.dataPartenza || null,
    alloggio: normalized.alloggio || null,
    alloggio_short: normalized.alloggioShort || null,
    esigenze_alimentari: normalized.esigenzeAlimentari || null,
    allergie: normalized.allergie || null,
    gruppo_leader: normalized.groupLeader || null,
    partecipa_intero_evento: normalized.partecipaInteroEvento,
    presenza_dettaglio: normalized.presenzaDettaglio,
    disabilita_accessibilita: normalized.disabilitaAccessibilita,
    difficolta_accessibilita: normalized.difficoltaAccessibilita || null,
    tally_submission_id: normalized.tallySubmissionId || null,
    tally_respondent_id: normalized.tallyRespondentId || null,
    eta: normalized.eta,
    is_minorenne: normalized.isMinorenne,
    note: normalized.note || null,
    privacy_accettata: normalized.privacyAccettata,
    submitted_at_tally: submittedAtIso,
    gruppo_label: normalized.gruppoLabel || null,
    dati_tally: payload,
  };

  let insertResult = await supabase.from("partecipanti").insert(fullInsert);

  if (insertResult.error) {
    const code = insertResult.error.code ?? "";
    const message = insertResult.error.message ?? "";

    const isMissingColumn =
      code === "42703" ||
      code === "PGRST204" ||
      /column .* does not exist/i.test(message);

    if (isMissingColumn) {
      console.warn("Missing normalized columns, fallback to minimal insert", {
        code,
        message,
      });

      insertResult = await supabase.from("partecipanti").insert({
        nome: normalized.nome,
        cognome: normalized.cognome,
        email: normalized.email,
        nazione: normalized.nazione || null,
        "città": normalized.citta || null,
        giorni_permanenza: normalized.nights ?? undefined,
        quota_totale: normalized.quotaTotale ?? undefined,
        gruppo_id: gruppoId,
        tally_submission_id: normalized.tallySubmissionId || null,
        tally_respondent_id: normalized.tallyRespondentId || null,
        dati_tally: payload,
      });
    }
  }

  if (insertResult.error) {
    const err = insertResult.error;
    const isEmailUniqueViolation =
      err.code === "23505" && /partecipanti_email_key/i.test(err.message);

    await logWebhookEvent(supabase, {
      submissionId,
      respondentId,
      email: normalized.email,
      status: "error",
      errorCode: err.code,
      errorMessage: err.message,
      payload,
      normalized: { ...normalized, gruppoId },
    });

    if (isEmailUniqueViolation) {
      return NextResponse.json(
        {
          error:
            "Email duplicata bloccata da vincolo DB. Rimuovi il constraint partecipanti_email_key per consentire più partecipanti con la stessa email.",
        },
        { status: 409 }
      );
    }

    console.error("Supabase insert error", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  await logWebhookEvent(supabase, {
    submissionId,
    respondentId,
    email: normalized.email,
    status: "success",
    payload,
    normalized: { ...normalized, gruppoId },
  });

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
