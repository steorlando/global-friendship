import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { loadEmailSenderRuntimeSettings } from "@/lib/email/settings";
import { sendGmailTextEmail } from "@/lib/email/gmail";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

function isValidEmail(value: string): boolean {
  return EMAIL_REGEX.test(value);
}

export async function POST(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const recipientEmail = normalizeText(body.recipientEmail);
  if (!recipientEmail || !isValidEmail(recipientEmail)) {
    return NextResponse.json({ error: "Valid recipientEmail is required" }, { status: 400 });
  }

  try {
    const settings = await loadEmailSenderRuntimeSettings(createSupabaseServiceClient());
    if (!settings.gmailAppPassword) {
      return NextResponse.json(
        { error: "Google App Password is not configured" },
        { status: 400 }
      );
    }

    await sendGmailTextEmail(
      {
        to: recipientEmail,
        subject: "Global Friendship - Email settings test",
        text: "This is a test email from Admin > Settings > Email.",
        from: settings.senderEmail,
      },
      {
        gmailUser: settings.gmailUser,
        gmailAppPassword: settings.gmailAppPassword,
        senderEmail: settings.senderEmail,
      }
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || "Unable to send test email" },
      { status: 500 }
    );
  }
}
