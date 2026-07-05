import type { SupabaseClient } from "@supabase/supabase-js";

type GroupNameRow = {
  id: string | null;
  nome: string | null;
};

function normalizeText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export async function loadGroupDisplayNamesById(
  supabase: SupabaseClient,
  rawGroupIds: Iterable<string | null | undefined>
): Promise<Map<string, string>> {
  const groupIds = [
    ...new Set(
      [...rawGroupIds]
        .map((groupId) => normalizeText(groupId))
        .filter((groupId): groupId is string => Boolean(groupId))
    ),
  ];

  if (groupIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("gruppi")
    .select("id,nome")
    .in("id", groupIds);

  if (error) throw new Error(error.message);

  const namesById = new Map<string, string>();
  for (const row of (data ?? []) as GroupNameRow[]) {
    const id = normalizeText(row.id);
    const name = normalizeText(row.nome);
    if (id && name) namesById.set(id, name);
  }

  return namesById;
}

export function groupDisplayName(
  groupId: string | null | undefined,
  namesById: ReadonlyMap<string, string>,
  fallback?: string | null
): string | null {
  const normalizedId = normalizeText(groupId);
  if (normalizedId) {
    const canonicalName = normalizeText(namesById.get(normalizedId));
    if (canonicalName) return canonicalName;
  }

  return normalizeText(fallback) ?? normalizedId;
}

export function groupDisplayNames(
  groupIds: Iterable<string | null | undefined>,
  namesById: ReadonlyMap<string, string>
): string[] {
  return [
    ...new Set(
      [...groupIds]
        .map((groupId) => groupDisplayName(groupId, namesById))
        .filter((name): name is string => Boolean(name))
    ),
  ].sort((a, b) => a.localeCompare(b));
}
