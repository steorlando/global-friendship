export const ARRIVAL_DATE_MIN = "2026-08-27";
export const ARRIVAL_DATE_MAX = "2026-08-29";
export const DEPARTURE_DATE_MIN = "2026-08-29";
export const DEPARTURE_DATE_MAX = "2026-08-31";

export const ALLOGGIO_OPTIONS = [
  "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
  "I'm staying at the accommodation provided by the organization / Alloggero presso la struttura fornita dall'organizzazione",
] as const;

export const ALLOGGIO_SHORT_OPTIONS = [
  "Provided by organization",
  "Atonoumous",
] as const;

const ALLOGGIO_SHORT_TO_LONG_MAP: Record<string, (typeof ALLOGGIO_OPTIONS)[number]> = {
  "Provided by organization": ALLOGGIO_OPTIONS[1],
  Atonoumous: ALLOGGIO_OPTIONS[0],
};

export function alloggioShortToLong(
  value: string | null | undefined
): (typeof ALLOGGIO_OPTIONS)[number] | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  if (trimmed in ALLOGGIO_SHORT_TO_LONG_MAP) {
    return ALLOGGIO_SHORT_TO_LONG_MAP[trimmed];
  }

  const lowered = trimmed.toLowerCase();
  if (
    lowered.includes("arranged my own accommodation") ||
    lowered.includes("alloggio autonomamente")
  ) {
    return ALLOGGIO_OPTIONS[0];
  }
  if (
    lowered.includes("accommodation provided by the organization") ||
    lowered.includes("struttura fornita dall'organizzazione") ||
    lowered.includes("struttura fornita dall’organizzazione")
  ) {
    return ALLOGGIO_OPTIONS[1];
  }

  if (ALLOGGIO_OPTIONS.includes(trimmed as (typeof ALLOGGIO_OPTIONS)[number])) {
    return trimmed as (typeof ALLOGGIO_OPTIONS)[number];
  }

  return null;
}

export function alloggioLongToShort(value: string | null | undefined): string | null {
  const normalizedLong = alloggioShortToLong(value);
  if (!normalizedLong) return null;
  return normalizedLong === ALLOGGIO_OPTIONS[0]
    ? ALLOGGIO_SHORT_OPTIONS[1]
    : ALLOGGIO_SHORT_OPTIONS[0];
}

export const ESIGENZE_ALIMENTARI_OPTIONS = [
  "Vegetarian",
  "Vegan",
  "I don't eat pork",
  "Other",
] as const;

export const DIFFICOLTA_ACCESSIBILITA_OPTIONS = [
  "Difficulty seeing, even when wearing glasses",
  "Difficulty hearing, even when using a hearing aid",
  "Difficulty walking or climbing steps",
  "Difficulty with self-care (washing or dressing)",
  "Difficulty concentrating or remembering",
  "Difficulty communicating or being understood",
  "I use a wheelchair or mobility aid",
  "I need accessible accommodation",
  "I need assistance during the event",
] as const;
