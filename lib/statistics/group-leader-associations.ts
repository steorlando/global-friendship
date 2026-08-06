import type { AppRole } from "@/lib/auth/roles";

/**
 * Operational profiles whose group links mean that the group is supervised.
 * Admins and managers can retain group-leader responsibilities while using a
 * broader dashboard role, so their links count for the statistics check too.
 */
export const STATISTICS_GROUP_LEADER_ROLES = [
  "capogruppo",
  "manager",
  "admin",
] as const satisfies readonly AppRole[];
