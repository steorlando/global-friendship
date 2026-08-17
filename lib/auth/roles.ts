export const AVAILABLE_ROLES = [
  "admin",
  "capogruppo",
  "partecipante",
  "manager",
  "alloggi",
  "accoglienza",
  "tour_manager",
] as const;

export type AppRole = (typeof AVAILABLE_ROLES)[number];

export const ROLE_ROUTES: Record<AppRole, string> = {
  admin: "/dashboard/admin",
  capogruppo: "/dashboard/capogruppo",
  partecipante: "/dashboard/partecipante",
  manager: "/dashboard/manager",
  alloggi: "/dashboard/alloggi",
  accoglienza: "/dashboard/accoglienza",
  tour_manager: "/dashboard/tour-manager",
};

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "Admin",
  capogruppo: "Group Leader",
  partecipante: "Participant",
  manager: "Manager",
  alloggi: "Accommodation",
  accoglienza: "Reception",
  tour_manager: "Tour manager",
};

export function isAppRole(value: string | null | undefined): value is AppRole {
  if (!value) return false;
  return AVAILABLE_ROLES.includes(value as AppRole);
}

export function roleRequiresGroups(role: string): boolean {
  return role !== "accoglienza" && role !== "tour_manager";
}
