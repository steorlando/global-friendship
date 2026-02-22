import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getGmailSenderAddress, sendGmailTextEmail } from "@/lib/email/gmail";
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

type ParticipantDbRow = {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  tally_submission_id: string | null;
  nazione: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  allergie: string | null;
  esigenze_alimentari: string | null;
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string | null;
  submitted_at_tally: string | null;
};

type ParticipantCandidate = {
  id: string;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  submitted_at_tally: string | null;
};

const alloggioSet = new Set<string>(ALLOGGIO_OPTIONS);
const esigenzeSet = new Set<string>(ESIGENZE_ALIMENTARI_OPTIONS);
const difficoltaSet = new Set<string>(DIFFICOLTA_ACCESSIBILITA_OPTIONS);

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

function pickLatest(rows: ParticipantDbRow[]): ParticipantDbRow | null {
  if (rows.length === 0) return null;

  return rows.reduce((best, current) => {
    if (!best) return current;
    const bestDate = best.submitted_at_tally ?? "";
    const currentDate = current.submitted_at_tally ?? "";
    return currentDate > bestDate ? current : best;
  }, rows[0]);
}

function toParticipantCandidate(row: ParticipantDbRow): ParticipantCandidate {
  return {
    id: row.id,
    nome: row.nome,
    cognome: row.cognome,
    gruppo_id: row.gruppo_id,
    gruppo_label: row.gruppo_label,
    submitted_at_tally: row.submitted_at_tally,
  };
}

async function getCurrentUserEmail() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { email: user.email.toLowerCase() };
}

async function loadParticipantsByEmail(
  email: string
): Promise<{ participants: ParticipantDbRow[]; error: string | null }> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("partecipanti")
    .select(
      "id,email,nome,cognome,gruppo_id,gruppo_label,tally_submission_id,nazione,data_nascita,data_arrivo,data_partenza,alloggio,allergie,esigenze_alimentari,disabilita_accessibilita,difficolta_accessibilita,submitted_at_tally"
    )
    .ilike("email", email);

  if (error) return { participants: [], error: error.message };
  const participants = ((data ?? []) as ParticipantDbRow[]).sort((a, b) =>
    (b.submitted_at_tally ?? "").localeCompare(a.submitted_at_tally ?? "")
  );
  return { participants, error: null };
}

async function resolveParticipantSelection(
  email: string,
  participantId: string | null
): Promise<
  | {
      participant: ParticipantDbRow;
      candidates: ParticipantCandidate[];
      requiresSelection: false;
    }
  | {
      selectionResponse: NextResponse;
    }
> {
  const { participants, error } = await loadParticipantsByEmail(email);
  if (error) {
    return {
      selectionResponse: NextResponse.json({ error }, { status: 500 }),
    };
  }

  if (participants.length === 0) {
    return {
      selectionResponse: NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      ),
    };
  }

  const candidates = participants.map(toParticipantCandidate);
  if (participantId) {
    const selected = participants.find((row) => row.id === participantId);
    if (!selected) {
      return {
        selectionResponse: NextResponse.json(
          {
            error: "Selected participant not found for this email",
            code: "PARTICIPANT_NOT_FOUND",
            requiresSelection: true,
            participants: candidates,
          },
          { status: 404 }
        ),
      };
    }

    return {
      participant: selected,
      candidates,
      requiresSelection: false,
    };
  }

  if (participants.length > 1) {
    return {
      selectionResponse: NextResponse.json(
        {
          error: "Multiple participants found for this email",
          code: "PARTICIPANT_SELECTION_REQUIRED",
          requiresSelection: true,
          participants: candidates,
        },
        { status: 409 }
      ),
    };
  }

  const participant = pickLatest(participants);
  if (!participant) {
    return {
      selectionResponse: NextResponse.json(
        { error: "Participant not found" },
        { status: 404 }
      ),
    };
  }

  return {
    participant,
    candidates,
    requiresSelection: false,
  };
}

export async function GET(req: Request) {
  const auth = await getCurrentUserEmail();
  if ("errorResponse" in auth) return auth.errorResponse;

  const url = new URL(req.url);
  const participantId = normalizeText(
    url.searchParams.get("participantId") ?? undefined
  );
  const selected = await resolveParticipantSelection(auth.email, participantId);
  if ("selectionResponse" in selected) return selected.selectionResponse;
  const { participant, candidates } = selected;

  return NextResponse.json({
    requiresSelection: false,
    participants: candidates,
    selectedParticipantId: participant.id,
    participant: {
      ...participant,
      esigenze_alimentari: parseStoredEsigenze(participant.esigenze_alimentari),
      difficolta_accessibilita: parseStoredDifficolta(
        participant.difficolta_accessibilita
      ),
    },
  });
}

export async function PATCH(req: Request) {
  const auth = await getCurrentUserEmail();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = normalizeText(body.participant_id);
  const selected = await resolveParticipantSelection(auth.email, participantId);
  if ("selectionResponse" in selected) return selected.selectionResponse;
  const { participant } = selected;

  const nome =
    "nome" in body
      ? normalizeText(body.nome)
      : normalizeText(participant.nome);
  const cognome =
    "cognome" in body
      ? normalizeText(body.cognome)
      : normalizeText(participant.cognome);
  const nazione =
    "nazione" in body ? normalizeText(body.nazione) : participant.nazione;
  const dataNascita =
    "data_nascita" in body
      ? normalizeText(body.data_nascita)
      : participant.data_nascita;
  const dataArrivo =
    "data_arrivo" in body
      ? normalizeText(body.data_arrivo)
      : participant.data_arrivo;
  const dataPartenza =
    "data_partenza" in body
      ? normalizeText(body.data_partenza)
      : participant.data_partenza;
  const alloggio =
    "alloggio" in body ? normalizeText(body.alloggio) : participant.alloggio;
  const allergie =
    "allergie" in body ? normalizeText(body.allergie) : participant.allergie;
  const esigenzeAlimentari =
    "esigenze_alimentari" in body
      ? normalizeEsigenze(body.esigenze_alimentari)
      : parseStoredEsigenze(participant.esigenze_alimentari);
  const difficoltaAccessibilita =
    "difficolta_accessibilita" in body
      ? normalizeDifficolta(body.difficolta_accessibilita)
      : parseStoredDifficolta(participant.difficolta_accessibilita);
  const disabilitaAccessibilita =
    "disabilita_accessibilita" in body &&
    typeof body.disabilita_accessibilita === "boolean"
      ? body.disabilita_accessibilita
      : Boolean(participant.disabilita_accessibilita);

  if (!nome || !cognome) {
    return NextResponse.json(
      { error: "nome and cognome are required" },
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

  const calculated = computeParticipantCalculatedFields({
    arrival: parseDateOnly(dataArrivo),
    departure: parseDateOnly(dataPartenza),
    dataNascita,
  });

  const service = createSupabaseServiceClient();
  const { error: updateError } = await service
    .from("partecipanti")
    .update({
      nome,
      cognome,
      nazione,
      data_nascita: dataNascita,
      data_arrivo: dataArrivo,
      data_partenza: dataPartenza,
      alloggio,
      allergie,
      esigenze_alimentari:
        esigenzeAlimentari.length > 0 ? esigenzeAlimentari.join(", ") : null,
      disabilita_accessibilita: disabilitaAccessibilita,
      difficolta_accessibilita:
        difficoltaAccessibilita.length > 0
          ? difficoltaAccessibilita.join(", ")
          : null,
      giorni_permanenza: calculated.giorniPermanenza,
      quota_totale: calculated.quotaTotale,
      eta: calculated.eta,
      is_minorenne: calculated.isMinorenne,
    })
    .eq("id", participant.id)
    .ilike("email", auth.email);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const auth = await getCurrentUserEmail();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantId = normalizeText(body.participant_id);
  const selected = await resolveParticipantSelection(auth.email, participantId);
  if ("selectionResponse" in selected) return selected.selectionResponse;
  const { participant } = selected;

  const confirmationEmail = normalizeText(body.confirmation_email)?.toLowerCase();
  if (!confirmationEmail) {
    return NextResponse.json(
      { error: "confirmation_email is required" },
      { status: 400 }
    );
  }

  if (confirmationEmail !== auth.email) {
    return NextResponse.json(
      { error: "confirmation_email does not match your account email" },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();
  const { error: deleteError } = await service
    .from("partecipanti")
    .delete()
    .eq("id", participant.id)
    .ilike("email", auth.email);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  const nome = (participant.nome ?? "").trim() || "Participant";
  const cognome = (participant.cognome ?? "").trim();
  const fullName = `${nome}${cognome ? ` ${cognome}` : ""}`.trim();
  const gruppo = (participant.gruppo_label ?? participant.gruppo_id ?? "").trim() || "-";
  const tallySubmissionId = (participant.tally_submission_id ?? "").trim() || "-";
  const subject = "Your Global Friendship registration has been cancelled";
  const text = [
    "Your registration cancellation has been completed.",
    "",
    `Name: ${fullName}`,
    `Group: ${gruppo}`,
    `Tally submission ID: ${tallySubmissionId}`,
    `Email: ${auth.email}`,
    "",
    "If this was not requested by you, please contact the organizers immediately.",
  ].join("\n");

  let emailSent = true;
  try {
    await sendGmailTextEmail({
      from: getGmailSenderAddress(),
      to: auth.email,
      subject,
      text,
    });
  } catch {
    emailSent = false;
  }

  return NextResponse.json({ ok: true, emailSent });
}
