import "server-only";

import { hasAccessibilityDeclaration } from "@/lib/statistics/accessibility";
import type { AccessibilityExportRow } from "@/lib/statistics/accessibility-export";
import { requireStaffAvailabilityManagerOrAdmin } from "@/lib/statistics/staff-availability-server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export { requireStaffAvailabilityManagerOrAdmin as requireAccessibilityManagerOrAdmin };

export async function loadAccessibilityRows(
  service: ReturnType<typeof createSupabaseServiceClient>,
): Promise<AccessibilityExportRow[]> {
  const { data, error } = await service
    .from("partecipanti")
    .select(
      "id,personal_code,email,telefono,nome,cognome,gruppo_label,gruppo_id,deleted_at,disabilita_accessibilita,difficolta_accessibilita",
    )
    .is("deleted_at", null)
    .order("gruppo_label", { ascending: true })
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as AccessibilityExportRow[]).filter(
    hasAccessibilityDeclaration,
  );
}
