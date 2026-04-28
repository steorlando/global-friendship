import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { checkLoginAccess } from "@/lib/auth/login-access";
import { loadEmailSenderRuntimeSettings } from "@/lib/email/settings";
import { sendGmailEmail } from "@/lib/email/gmail";

type MagicLinkBody = {
  email?: unknown;
  role?: unknown;
};

type GenerateLinkResponse = {
  hashed_token?: string;
  verification_type?: EmailOtpType;
  msg?: string;
  error?: string;
  error_description?: string;
};

const requestTimestampsByEmail = new Map<string, number>();
const REQUEST_INTERVAL_MS = 60_000;

function getAppBaseUrl(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
  if (configured) return configured;

  const origin = request.headers.get("origin") || new URL(request.url).origin;
  return origin.replace(/\/+$/, "");
}

function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  return url.replace(/\/+$/, "");
}

function getServiceRoleKey(): string {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");
  }
  return key;
}

function getErrorMessage(payload: GenerateLinkResponse): string {
  return payload.msg || payload.error_description || payload.error || "Unable to generate magic link";
}

async function generateMagicLinkToken(email: string): Promise<{
  tokenHash: string;
  type: EmailOtpType;
}> {
  const supabaseUrl = getSupabaseUrl();
  const serviceRoleKey = getServiceRoleKey();
  const response = await fetch(`${supabaseUrl}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      type: "magiclink",
      email,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as GenerateLinkResponse;
  if (!response.ok || !payload.hashed_token || !payload.verification_type) {
    throw new Error(getErrorMessage(payload));
  }

  return {
    tokenHash: payload.hashed_token,
    type: payload.verification_type,
  };
}

function buildCallbackUrl(request: Request, input: {
  tokenHash: string;
  type: EmailOtpType;
  role: string;
}): string {
  const callbackUrl = new URL("/auth/callback", getAppBaseUrl(request));
  callbackUrl.searchParams.set("token_hash", input.tokenHash);
  callbackUrl.searchParams.set("type", input.type);
  callbackUrl.searchParams.set("role", input.role);
  return callbackUrl.toString();
}

function buildEmailHtml(link: string): string {
  return `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Global Friendship - Access Link 🌍</h1>
      <p>You are receiving this email to access the <strong>Global Friendship</strong> platform, the event organized by <strong>Youth for Peace</strong>.</p>
      <p>Through this portal you can review your information and access your functions as a participant, group leader, or manager.</p>
      <p><strong>Click the link below to securely log in:</strong></p>
      <p style="margin: 24px 0;">
        <a href="${link}" style="background: #4f46e5; color: #ffffff; padding: 10px 16px; border-radius: 8px; text-decoration: none; display: inline-block;">
          👉 Access the Global Friendship Portal
        </a>
      </p>
      <p>When using <strong>Safari</strong> in <strong>Private Browsing mode</strong>, the login does not work. If this happens, please try using <strong>Chrome</strong>, copying and pasting the link.</p>
      <p>Con <strong>Safari</strong> in <strong>modalità privata</strong> il login non funziona. Nel caso prova con <strong>Chrome</strong>, copiando e incollando il link.</p>
    </div>
  `;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MagicLinkBody;
    const access = await checkLoginAccess(body.email, body.role);
    if (!access.ok) {
      return NextResponse.json(
        { ok: false, code: access.code, message: access.message },
        { status: access.status }
      );
    }

    const lastRequestAt = requestTimestampsByEmail.get(access.email) ?? 0;
    const now = Date.now();
    if (now - lastRequestAt < REQUEST_INTERVAL_MS) {
      return NextResponse.json(
        { ok: false, code: "RATE_LIMITED" },
        { status: 429 }
      );
    }
    requestTimestampsByEmail.set(access.email, now);

    const token = await generateMagicLinkToken(access.email);
    const link = buildCallbackUrl(request, {
      tokenHash: token.tokenHash,
      type: token.type,
      role: access.role,
    });
    const settings = await loadEmailSenderRuntimeSettings();

    if (!settings.gmailAppPassword) {
      throw new Error("Missing Gmail app password");
    }

    await sendGmailEmail(
      {
        to: access.email,
        from: settings.senderEmail,
        subject: "Global Friendship - Magic link",
        text: [
          "Global Friendship - Access Link 🌍",
          "",
          "You are receiving this email to access the Global Friendship platform, the event organized by Youth for Peace.",
          "",
          "Through this portal you can review your information and access your functions as a participant, group leader, or manager.",
          "",
          "Click the link below to securely log in:",
          link,
          "",
          "When using Safari in Private Browsing mode, the login does not work. If this happens, please try using Chrome, copying and pasting the link.",
          "",
          "Con Safari in modalità privata il login non funziona. Nel caso prova con Chrome, copiando e incollando il link.",
        ].join("\n"),
        html: buildEmailHtml(link),
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
      {
        ok: false,
        code: "MAGIC_LINK_FAILED",
        message: error instanceof Error ? error.message : "Unable to send magic link",
      },
      { status: 500 }
    );
  }
}
