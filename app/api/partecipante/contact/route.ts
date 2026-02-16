import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { getGmailSenderAddress, sendGmailTextEmail } from "@/lib/email/gmail";

type ParticipantContactRow = {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
  tally_submission_id: string | null;
  submitted_at_tally: string | null;
};

const ORGANIZERS_EMAIL = "info@giovaniperlapace.it";

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function pickLatest(rows: ParticipantContactRow[]): ParticipantContactRow | null {
  if (rows.length === 0) return null;
  return rows.reduce((best, current) => {
    const bestDate = best.submitted_at_tally ?? "";
    const currentDate = current.submitted_at_tally ?? "";
    return currentDate > bestDate ? current : best;
  }, rows[0]);
}

function buildParticipantGroup(row: ParticipantContactRow): string {
  const value = row.gruppo_label ?? row.gruppo_id ?? "";
  return value.trim() || "-";
}

export async function POST(req: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const userEmail = (user?.email ?? "").trim().toLowerCase();
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const message = normalizeText(body.message);
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json(
      { error: "Message is too long (max 4000 characters)" },
      { status: 400 }
    );
  }

  const service = createSupabaseServiceClient();
  const { data, error } = await service
    .from("partecipanti")
    .select(
      "id,email,nome,cognome,gruppo_id,gruppo_label,tally_submission_id,submitted_at_tally"
    )
    .ilike("email", userEmail);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const participant = pickLatest((data ?? []) as ParticipantContactRow[]);
  if (!participant) {
    return NextResponse.json({ error: "Participant not found" }, { status: 404 });
  }

  const nome = (participant.nome ?? "").trim() || "-";
  const cognome = (participant.cognome ?? "").trim() || "-";
  const gruppo = buildParticipantGroup(participant);
  const tallySubmissionId = (participant.tally_submission_id ?? "").trim() || "-";
  const from = getGmailSenderAddress();

  const subject = `Participant message - ${nome} ${cognome}`;
  const text = [
    "A participant sent a message to the organizers.",
    "",
    `Participant name: ${nome}`,
    `Participant surname: ${cognome}`,
    `Participant group: ${gruppo}`,
    `Tally submission ID: ${tallySubmissionId}`,
    `Participant email: ${userEmail}`,
    "",
    "Message:",
    message,
  ].join("\n");

  try {
    await sendGmailTextEmail({ from, to: ORGANIZERS_EMAIL, subject, text, replyTo: userEmail });
  } catch (sendError) {
    return NextResponse.json(
      { error: (sendError as Error).message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
