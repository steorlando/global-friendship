import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendGmailEmail } from "@/lib/email/gmail";
import {
  htmlToText,
  renderParticipantTemplateHtml,
  renderParticipantTemplateText,
  type ParticipantTemplateData,
} from "@/lib/email/participant-template";
import {
  DIFFICOLTA_ACCESSIBILITA_OPTIONS,
  ESIGENZE_ALIMENTARI_OPTIONS,
  alloggioLongToShort,
} from "@/lib/partecipante/constants";

type ParticipantRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  telefono: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  alloggio_short: string | null;
  allergie: string | null;
  esigenze_alimentari: string | null;
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string | null;
  quota_totale: number | null;
  gruppo_id: string | null;
  gruppo_label: string | null;
};

const SELECT_FIELDS =
  "id,nome,cognome,email,telefono,paese_residenza,nazione,data_nascita,data_arrivo,data_partenza,alloggio,alloggio_short,allergie,esigenze_alimentari,disabilita_accessibilita,difficolta_accessibilita,quota_totale,gruppo_id,gruppo_label";

const esigenzeSet = new Set<string>(ESIGENZE_ALIMENTARI_OPTIONS);
const difficoltaSet = new Set<string>(DIFFICOLTA_ACCESSIBILITA_OPTIONS);

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseStoredEsigenze(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && esigenzeSet.has(item));
}

function parseStoredDifficolta(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item && difficoltaSet.has(item));
}

function buildGroupLabel(row: ParticipantRow): string {
  const value = (row.gruppo_label ?? row.gruppo_id ?? "").trim();
  return value || "-";
}

function toTemplateData(row: ParticipantRow): ParticipantTemplateData {
  return {
    id: row.id,
    nome: row.nome,
    cognome: row.cognome,
    email: row.email,
    telefono: row.telefono,
    paese_residenza: row.paese_residenza,
    nazione: row.nazione,
    data_nascita: row.data_nascita,
    data_arrivo: row.data_arrivo,
    data_partenza: row.data_partenza,
    alloggio: row.alloggio_short ?? alloggioLongToShort(row.alloggio),
    allergie: row.allergie,
    esigenze_alimentari: parseStoredEsigenze(row.esigenze_alimentari),
    disabilita_accessibilita: row.disabilita_accessibilita,
    difficolta_accessibilita: parseStoredDifficolta(row.difficolta_accessibilita),
    quota_totale: row.quota_totale,
    group: buildGroupLabel(row),
  };
}

async function requireManagerOrAdmin() {
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

  if (profile?.ruolo !== "manager" && profile?.ruolo !== "admin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { service };
}

export async function POST(req: Request) {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const participantIds = Array.isArray(body.participantIds)
    ? [...new Set(body.participantIds.filter((item) => typeof item === "string"))]
    : [];
  const subjectTemplate = normalizeText(body.subject);
  const htmlTemplate = normalizeText(body.html);

  if (participantIds.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  if (!subjectTemplate) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }

  if (!htmlTemplate) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const { data, error } = await auth.service
    .from("partecipanti")
    .select(SELECT_FIELDS)
    .in("id", participantIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as ParticipantRow[];
  const byId = new Map(rows.map((row) => [row.id, row]));
  const recipients = participantIds
    .map((id) => byId.get(id))
    .filter((row): row is ParticipantRow => Boolean(row));

  if (recipients.length === 0) {
    return NextResponse.json({ error: "No matching recipients found" }, { status: 404 });
  }

  const sentTo: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const failed: { id: string; reason: string }[] = [];

  for (const row of recipients) {
    const participant = toTemplateData(row);
    const to = normalizeText(participant.email);
    if (!to) {
      skipped.push({ id: row.id, reason: "Missing email" });
      continue;
    }

    const subject = renderParticipantTemplateText(subjectTemplate, participant);
    const html = renderParticipantTemplateHtml(htmlTemplate, participant);
    const text = htmlToText(html);

    try {
      await sendGmailEmail({
        to,
        subject,
        html,
        text,
      });
      sentTo.push(row.id);
    } catch (sendError) {
      const reason = sendError instanceof Error ? sendError.message : "Send failed";
      failed.push({ id: row.id, reason });
    }
  }

  return NextResponse.json({
    requested: participantIds.length,
    resolved: recipients.length,
    sent: sentTo.length,
    sentIds: sentTo,
    skipped,
    failed,
  });
}
