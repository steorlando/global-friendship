import type { AppRole } from "@/lib/auth/roles";

const PARTICIPANT_TOURS_PATH = "/dashboard/partecipante/tours";

export function safePostLoginPath(
  value: unknown,
  role: AppRole | null | undefined
): string | null {
  if (role !== "partecipante" || typeof value !== "string") return null;
  return value === PARTICIPANT_TOURS_PATH ? value : null;
}
