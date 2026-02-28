import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const DEFAULT_GMAIL_SENDER_EMAIL =
  process.env.PARTECIPANTE_CONTACT_FROM_EMAIL ||
  process.env.GMAIL_USER ||
  "europeanyouthmeeting@gmail.com";

export const DEFAULT_GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD || "";

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

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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
  const configuredSender = normalizeText(row?.sender_email);
  const configuredPassword = normalizeText(row?.gmail_app_password);

  const senderEmail = configuredSender ?? DEFAULT_GMAIL_SENDER_EMAIL;
  const gmailUser = configuredSender ?? process.env.GMAIL_USER ?? senderEmail;
  const gmailAppPassword = configuredPassword ?? DEFAULT_GMAIL_APP_PASSWORD;

  return {
    senderEmail,
    gmailUser,
    gmailAppPassword,
    hasCustomSettings: Boolean(configuredSender || configuredPassword),
  };
}
