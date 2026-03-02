import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeEmail(value: unknown): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;
  if (EMAIL_REGEX.test(normalized)) return normalized;

  // Accept display-name format: "Team Name <mailbox@example.com>"
  const bracketMatch = normalized.match(/<([^>]+)>/);
  const bracketEmail = bracketMatch?.[1]?.trim() ?? "";
  if (EMAIL_REGEX.test(bracketEmail)) return bracketEmail;

  return null;
}

function normalizeAppPassword(value: unknown): string {
  const normalized = normalizeText(value);
  if (!normalized) return "";
  // Google App Password is shown as 4x4 blocks with spaces; SMTP expects contiguous value.
  return normalized.replace(/\s+/g, "");
}

export const DEFAULT_GMAIL_SENDER_EMAIL =
  normalizeEmail(process.env.PARTECIPANTE_CONTACT_FROM_EMAIL) ||
  normalizeEmail(process.env.GMAIL_USER) ||
  "europeanyouthmeeting@gmail.com";

export const DEFAULT_GMAIL_APP_PASSWORD = normalizeAppPassword(process.env.GMAIL_APP_PASSWORD);

type AdminEmailSettingsRow = {
  id: boolean;
  sender_email: string;
  gmail_app_password: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSenderRuntimeSettings = {
  senderEmail: string;
  gmailUser: string;
  gmailAppPassword: string;
  hasCustomSettings: boolean;
};

export async function loadAdminEmailSettings(
  service: SupabaseClient = createSupabaseServiceClient()
) {
  const { data, error } = await service
    .from("admin_email_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AdminEmailSettingsRow | null) ?? null;
}

export async function loadEmailSenderRuntimeSettings(
  service: SupabaseClient = createSupabaseServiceClient()
): Promise<EmailSenderRuntimeSettings> {
  const row = await loadAdminEmailSettings(service);
  const configuredSender = normalizeEmail(row?.sender_email);
  const configuredPassword = normalizeAppPassword(row?.gmail_app_password);

  // Custom SMTP settings are considered active only when both sender + app password are set.
  // This avoids broken states when only sender is changed from UI.
  const hasCompleteCustomConfig = Boolean(configuredSender && configuredPassword);

  const senderEmail = hasCompleteCustomConfig
    ? (configuredSender as string)
    : DEFAULT_GMAIL_SENDER_EMAIL;
  const gmailUser = hasCompleteCustomConfig
    ? (configuredSender as string)
    : process.env.GMAIL_USER ?? senderEmail;
  const gmailAppPassword = hasCompleteCustomConfig
    ? (configuredPassword as string)
    : DEFAULT_GMAIL_APP_PASSWORD;

  return {
    senderEmail,
    gmailUser,
    gmailAppPassword,
    hasCustomSettings: hasCompleteCustomConfig,
  };
}
