const CANONICAL_CITY_LABELS: Record<string, string> = {
  innsbruck: "Innsbruck",
  kyiv: "Kyiv",
  liege: "Liège",
};

const CITY_KEY_ALIASES: Record<string, string> = {
  kiev: "kyiv",
};

function compactCityText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function registrationCityKey(value: string | null | undefined): string {
  const compact = compactCityText(value);
  if (!compact) return "";

  const key = compact
    .normalize("NFD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim();

  return CITY_KEY_ALIASES[key] ?? key;
}

export function normalizeRegistrationCityLabel(
  value: string | null | undefined,
): string | null {
  const compact = compactCityText(value);
  if (!compact) return null;

  const key = registrationCityKey(compact);
  return CANONICAL_CITY_LABELS[key] ?? compact;
}

export function registrationCitiesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const leftKey = registrationCityKey(left);
  return Boolean(leftKey) && leftKey === registrationCityKey(right);
}
