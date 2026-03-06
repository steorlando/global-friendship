const UUID_PATTERN =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\b/g;

function normalizeRecipientId(id: string): string {
  return id.trim().toLowerCase();
}

export function parseRecipientIdsFromText(input: string): string[] {
  if (!input.trim()) return [];
  const matches = input.match(UUID_PATTERN) ?? [];
  const unique = new Set<string>();

  for (const match of matches) {
    const normalized = normalizeRecipientId(match);
    if (normalized) unique.add(normalized);
  }

  return [...unique];
}

export function buildRecipientIdsClipboardText(recipientIds: string[]): string {
  const unique = new Set<string>();

  for (const id of recipientIds) {
    const normalized = normalizeRecipientId(id);
    if (normalized) unique.add(normalized);
  }

  return [...unique].join("\n");
}

export function isRecipientIdExcluded(id: string, excludedIds: Set<string>): boolean {
  return excludedIds.has(normalizeRecipientId(id));
}

export function excludeRecipientsById<T extends { id: string }>(
  rows: T[],
  excludedIds: Set<string>
): T[] {
  if (excludedIds.size === 0) return rows;
  return rows.filter((row) => !isRecipientIdExcluded(row.id, excludedIds));
}
