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
  renderGroupLeaderTemplateHtml,
  renderGroupLeaderTemplateText,
  type GroupLeaderTemplateData,
} from "@/lib/email/group-leader-template";
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

type GroupLeaderRow = {
  id: string;
  email: string | null;
  nome: string | null;
  cognome: string | null;
  ruolo: string | null;
  telefono: string | null;
  italia: boolean | null;
  roma: boolean | null;
  gruppi?: string[];
};

type ProfileGroupRow = {
  profilo_id: string | null;
  gruppo_id: string | null;
};

type EmailAttachment = {
  filename: string;
  content: string;
  encoding: "base64";
  contentType?: string;
};

const SELECT_FIELDS =
  "id,nome,cognome,email,telefono,paese_residenza,nazione,data_nascita,data_arrivo,data_partenza,alloggio,alloggio_short,allergie,esigenze_alimentari,disabilita_accessibilita,difficolta_accessibilita,quota_totale,gruppo_id,gruppo_label";
const GROUP_LEADER_SELECT_FIELDS = "id,email,nome,cognome,ruolo,telefono,italia,roma";
const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BASE64_LENGTH = 10 * 1024 * 1024;
const MAX_TOTAL_BASE64_LENGTH = 20 * 1024 * 1024;

const esigenzeSet = new Set<string>(ESIGENZE_ALIMENTARI_OPTIONS);
const difficoltaSet = new Set<string>(DIFFICOLTA_ACCESSIBILITA_OPTIONS);

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function parseAttachments(value: unknown): { attachments: EmailAttachment[]; error: string | null } {
  if (!Array.isArray(value)) {
    return { attachments: [], error: null };
  }

  if (value.length > MAX_ATTACHMENTS) {
    return {
      attachments: [],
      error: `Too many attachments. Maximum is ${MAX_ATTACHMENTS}.`,
    };
  }

  const attachments: EmailAttachment[] = [];
  let totalLength = 0;

  for (const item of value) {
    if (!item || typeof item !== "object") {
      return { attachments: [], error: "Invalid attachment payload." };
    }

    const raw = item as Record<string, unknown>;
    const filename = normalizeText(raw.filename);
    const content = typeof raw.content === "string" ? raw.content.trim() : "";
    const encoding = raw.encoding;
    const contentType =
      typeof raw.contentType === "string" && raw.contentType.trim()
        ? raw.contentType.trim()
        : undefined;

    if (!filename || !content || encoding !== "base64") {
      return { attachments: [], error: "Invalid attachment payload." };
    }

    if (content.length > MAX_ATTACHMENT_BASE64_LENGTH) {
      return { attachments: [], error: `Attachment "${filename}" is too large.` };
    }

    totalLength += content.length;
    if (totalLength > MAX_TOTAL_BASE64_LENGTH) {
      return { attachments: [], error: "Total attachment size is too large." };
    }

    attachments.push({
      filename,
      content,
      encoding: "base64",
      contentType,
    });
  }

  return { attachments, error: null };
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

function toGroupLeaderTemplateData(row: GroupLeaderRow): GroupLeaderTemplateData {
  return {
    id: row.id,
    email: row.email,
    nome: row.nome,
    cognome: row.cognome,
    ruolo: row.ruolo,
    telefono: row.telefono,
    italia: row.italia,
    roma: row.roma,
    gruppi: row.gruppi ?? [],
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

  const recipientType =
    body.recipientType === "group_leaders" ? "group_leaders" : "participants";
  const recipientIdsInput = Array.isArray(body.recipientIds)
    ? body.recipientIds
    : Array.isArray(body.participantIds)
      ? body.participantIds
      : [];
  const recipientIds = [
    ...new Set(recipientIdsInput.filter((item): item is string => typeof item === "string")),
  ];
  const subjectTemplate = normalizeText(body.subject);
  const htmlTemplate = normalizeText(body.html);
  const parsedAttachments = parseAttachments(body.attachments);
  if (parsedAttachments.error) {
    return NextResponse.json({ error: parsedAttachments.error }, { status: 400 });
  }
  const attachments = parsedAttachments.attachments;

  if (recipientIds.length === 0) {
    return NextResponse.json({ error: "No recipients selected" }, { status: 400 });
  }

  if (!subjectTemplate) {
    return NextResponse.json({ error: "Subject is required" }, { status: 400 });
  }

  if (!htmlTemplate) {
    return NextResponse.json({ error: "Message body is required" }, { status: 400 });
  }

  const sentTo: string[] = [];
  const skipped: { id: string; reason: string }[] = [];
  const failed: { id: string; reason: string }[] = [];

  if (recipientType === "group_leaders") {
    const { data, error } = await auth.service
      .from("profili")
      .select(GROUP_LEADER_SELECT_FIELDS)
      .eq("ruolo", "capogruppo")
      .in("id", recipientIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as GroupLeaderRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const recipients = recipientIds
      .map((id) => byId.get(id))
      .filter((row): row is GroupLeaderRow => Boolean(row));

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No matching recipients found" }, { status: 404 });
    }

    const groupsByLeader = new Map<string, string[]>();
    const leaderIds = recipients.map((recipient) => recipient.id);
    if (leaderIds.length > 0) {
      const { data: profileGroups, error: groupsError } = await auth.service
        .from("profili_gruppi")
        .select("profilo_id,gruppo_id")
        .in("profilo_id", leaderIds);

      if (groupsError) {
        return NextResponse.json({ error: groupsError.message }, { status: 500 });
      }

      for (const row of (profileGroups ?? []) as ProfileGroupRow[]) {
        const profileId = (row.profilo_id ?? "").trim();
        const groupId = (row.gruppo_id ?? "").trim();
        if (!profileId || !groupId) continue;
        const existing = groupsByLeader.get(profileId) ?? [];
        if (!existing.includes(groupId)) {
          existing.push(groupId);
          existing.sort((a, b) => a.localeCompare(b));
          groupsByLeader.set(profileId, existing);
        }
      }
    }

    for (const row of recipients) {
      const groupLeader = toGroupLeaderTemplateData({
        ...row,
        gruppi: groupsByLeader.get(row.id) ?? [],
      });
      const to = normalizeText(groupLeader.email);
      if (!to) {
        skipped.push({ id: row.id, reason: "Missing email" });
        continue;
      }

      const subject = renderGroupLeaderTemplateText(subjectTemplate, groupLeader);
      const html = renderGroupLeaderTemplateHtml(htmlTemplate, groupLeader);
      const text = htmlToText(html);

      try {
        await sendGmailEmail({ to, subject, html, text, attachments });
        sentTo.push(row.id);
      } catch (sendError) {
        const reason = sendError instanceof Error ? sendError.message : "Send failed";
        failed.push({ id: row.id, reason });
      }
    }
  } else {
    const { data, error } = await auth.service
      .from("partecipanti")
      .select(SELECT_FIELDS)
      .in("id", recipientIds);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (data ?? []) as ParticipantRow[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    const recipients = recipientIds
      .map((id) => byId.get(id))
      .filter((row): row is ParticipantRow => Boolean(row));

    if (recipients.length === 0) {
      return NextResponse.json({ error: "No matching recipients found" }, { status: 404 });
    }

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
        await sendGmailEmail({ to, subject, html, text, attachments });
        sentTo.push(row.id);
      } catch (sendError) {
        const reason = sendError instanceof Error ? sendError.message : "Send failed";
        failed.push({ id: row.id, reason });
      }
    }
  }

  return NextResponse.json({
    recipientType,
    requested: recipientIds.length,
    resolved: sentTo.length + skipped.length + failed.length,
    sent: sentTo.length,
    sentIds: sentTo,
    skipped,
    failed,
  });
}
