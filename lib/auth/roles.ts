export const AVAILABLE_ROLES = [
  "admin",
  "capogruppo",
  "partecipante",
  "manager",
  "alloggi",
] as const;

export type AppRole = (typeof AVAILABLE_ROLES)[number];

export const ROLE_ROUTES: Record<AppRole, string> = {
  admin: "/dashboard/admin",
  capogruppo: "/dashboard/capogruppo",
  partecipante: "/dashboard/partecipante",
  manager: "/dashboard/manager",
  alloggi: "/dashboard/alloggi",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  capogruppo: "Group Leader",
  partecipante: "Participant",
  manager: "Manager",
  alloggi: "Accommodation",
};

export function isAppRole(value: string | null | undefined): value is AppRole {
  if (!value) return false;
  return AVAILABLE_ROLES.includes(value as AppRole);
}
