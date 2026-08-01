function normalizeFilterValue(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function matchesParticipantFilterSelection(
  participantValue: string | null | undefined,
  selectedValues: ReadonlySet<string>
): boolean {
  if (selectedValues.size === 0) return true;

  const normalizedParticipantValue = normalizeFilterValue(participantValue);
  return [...selectedValues].some(
    (selectedValue) => normalizeFilterValue(selectedValue) === normalizedParticipantValue
  );
}
