import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { DEFAULT_GMAIL_SENDER_EMAIL, loadAdminEmailSettings } from "@/lib/email/settings";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const service = createSupabaseServiceClient();
    const row = await loadAdminEmailSettings(service);

    return NextResponse.json({
      senderEmail: row?.sender_email ?? DEFAULT_GMAIL_SENDER_EMAIL,
      passwordIsSet: Boolean(normalizeText(row?.gmail_app_password)),
      updatedAt: row?.updated_at ?? null,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const senderEmail = normalizeText(body.senderEmail);
  if (!senderEmail || !isValidEmail(senderEmail)) {
    return NextResponse.json({ error: "Valid senderEmail is required" }, { status: 400 });
  }

  const passwordInputRaw = body.googleAppPassword;
  const hasPasswordInput = typeof passwordInputRaw === "string";
  const passwordInput = normalizeText(passwordInputRaw);

  try {
    const service = createSupabaseServiceClient();
    const existing = await loadAdminEmailSettings(service);
    const passwordToStore =
      hasPasswordInput && passwordInput
        ? passwordInput
        : existing?.gmail_app_password ?? null;

    const { data, error } = await service
      .from("admin_email_settings")
      .upsert(
        {
          id: true,
          sender_email: senderEmail,
          gmail_app_password: passwordToStore,
        },
        { onConflict: "id" }
      )
      .select("sender_email,gmail_app_password,updated_at")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      senderEmail: data.sender_email,
      passwordIsSet: Boolean(normalizeText(data.gmail_app_password)),
      updatedAt: data.updated_at,
    });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

export const PUT = PATCH;
