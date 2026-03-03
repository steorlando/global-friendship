import { NextResponse } from "next/server";
import { isAppRole, type AppRole } from "@/lib/auth/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

type PreflightBody = {
  email?: unknown;
  role?: unknown;
};

function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function toRole(value: unknown): AppRole | null {
  const role = String(value ?? "");
  return isAppRole(role) ? role : null;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreflightBody;
    const email = normalizeEmail(body.email);
    const role = toRole(body.role);

    if (!email) {
      return NextResponse.json(
        { ok: false, code: "EMAIL_REQUIRED" },
        { status: 400 }
      );
    }

    if (!role) {
      return NextResponse.json(
        { ok: false, code: "ROLE_INVALID" },
        { status: 400 }
      );
    }

    const service = createSupabaseServiceClient();

    if (role === "partecipante") {
      const { data, error } = await service
        .from("partecipanti")
        .select("id")
        .ilike("email", email)
        .limit(1);

      if (error) {
        return NextResponse.json(
          { ok: false, code: "CHECK_FAILED", message: error.message },
          { status: 500 }
        );
      }

      if (!data || data.length === 0) {
        return NextResponse.json(
          { ok: false, code: "PARTICIPANT_NOT_FOUND" },
          { status: 404 }
        );
      }

      return NextResponse.json({ ok: true });
    }

    const { data: profiles, error: profileError } = await service
      .from("profili")
      .select("id,ruolo")
      .ilike("email", email)
      .eq("ruolo", role)
      .limit(1);

    if (profileError) {
      return NextResponse.json(
        { ok: false, code: "CHECK_FAILED", message: profileError.message },
        { status: 500 }
      );
    }

    if (!profiles || profiles.length === 0) {
      return NextResponse.json(
        { ok: false, code: "PROFILE_NOT_FOUND" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        code: "BAD_REQUEST",
        message: error instanceof Error ? error.message : "Invalid request",
      },
      { status: 400 }
    );
  }
}
