import { isAppRole, type AppRole } from "@/lib/auth/roles";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export type LoginAccessCheckResult =
  | { ok: true; email: string; role: AppRole }
  | { ok: false; status: number; code: string; message?: string };

export function normalizeLoginEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function parseLoginRole(value: unknown): AppRole | null {
  const role = String(value ?? "");
  return isAppRole(role) ? role : null;
}

export async function checkLoginAccess(
  emailInput: unknown,
  roleInput: unknown
): Promise<LoginAccessCheckResult> {
  const email = normalizeLoginEmail(emailInput);
  const role = parseLoginRole(roleInput);

  if (!email) {
    return { ok: false, status: 400, code: "EMAIL_REQUIRED" };
  }

  if (!role) {
    return { ok: false, status: 400, code: "ROLE_INVALID" };
  }

  const service = createSupabaseServiceClient();

  if (role === "partecipante") {
    const { data, error } = await service
      .from("partecipanti")
      .select("id")
      .ilike("email", email)
      .limit(1);

    if (error) {
      return {
        ok: false,
        status: 500,
        code: "CHECK_FAILED",
        message: error.message,
      };
    }

    if (!data || data.length === 0) {
      return { ok: false, status: 404, code: "PARTICIPANT_NOT_FOUND" };
    }

    return { ok: true, email, role };
  }

  const { data: profiles, error: profileError } = await service
    .from("profili")
    .select("id,ruolo")
    .ilike("email", email)
    .eq("ruolo", role)
    .limit(1);

  if (profileError) {
    return {
      ok: false,
      status: 500,
      code: "CHECK_FAILED",
      message: profileError.message,
    };
  }

  if (!profiles || profiles.length === 0) {
    return { ok: false, status: 404, code: "PROFILE_NOT_FOUND" };
  }

  return { ok: true, email, role };
}
