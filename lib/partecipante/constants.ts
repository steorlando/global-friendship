export const ARRIVAL_DATE_MIN = "2026-08-27";
export const ARRIVAL_DATE_MAX = "2026-08-29";
export const DEPARTURE_DATE_MIN = "2026-08-29";
export const DEPARTURE_DATE_MAX = "2026-08-31";

export const ALLOGGIO_OPTIONS = [
  "I arranged my own accommodation / Ho trovato un alloggio autonomamente",
  "I'm staying at the accommodation provided by the organization / Alloggero presso la struttura fornita dall'organizzazione",
] as const;

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
