import { ESIGENZE_ALIMENTARI_OPTIONS } from "../partecipante/constants.ts";

export const FOOD_NEEDS_FORM_FILTERS = [
  "vegetarian",
  "vegan",
  "no_pork",
  "other",
  "allergies",
] as const;

export const FOOD_NEEDS_TEXT_FILTERS = [
  "gluten_celiac",
  "lactose_dairy",
  "nuts_peanuts",
  "fish_shellfish",
] as const;

export const FOOD_NEEDS_FILTERS = [
  ...FOOD_NEEDS_FORM_FILTERS,
  ...FOOD_NEEDS_TEXT_FILTERS,
] as const;

export type FoodNeedsFilter = (typeof FOOD_NEEDS_FILTERS)[number];

export type FoodNeedsParticipantRow = {
  esigenze_alimentari?: string | null;
  allergie?: string | null;
};

type DietaryOptionFilter = Exclude<
  (typeof FOOD_NEEDS_FORM_FILTERS)[number],
  "allergies"
>;

const OPTION_BY_FILTER: Record<
  DietaryOptionFilter,
  (typeof ESIGENZE_ALIMENTARI_OPTIONS)[number]
> = {
  vegetarian: ESIGENZE_ALIMENTARI_OPTIONS[0],
  vegan: ESIGENZE_ALIMENTARI_OPTIONS[1],
  no_pork: ESIGENZE_ALIMENTARI_OPTIONS[2],
  other: ESIGENZE_ALIMENTARI_OPTIONS[3],
};

const foodNeedsFilterSet = new Set<string>(FOOD_NEEDS_FILTERS);
const ignoredDietaryValues = new Set(["", "false", "null", "undefined"]);
const negativeFoodTextValues = new Set([
  "",
  "no",
  "none",
  "nothing",
  "nothing at all",
  "nil",
  "n a",
  "na",
  "not applicable",
  "nessuna",
  "nessuno",
  "nulla",
  "niente",
  "nessuna nothing",
  "normal",
  "ni",
  "nein",
  "keine",
  "nee",
  "geen",
  "aucune",
  "aucun",
  "rien",
  "ninguna",
  "ninguno",
  "nenhuma",
  "nenhum",
  "brak",
  "nie",
  "нет",
  "немає",
  "нема",
  "никаких",
  "ніяких",
  "i eat everything",
  "i am eat everything",
  "im eat everything",
  "they eat everything",
  "ik eet van alles",
  "non vegetarian",
]);

const negativeAllergyPatterns = [
  /^(?:i dont have|i do not have) (?:any )?(?:allergy|allergies|allergie|intolerance|intolerances)$/,
  /^no (?:known )?(?:allergy|allergies|intolerance|intolerances)$/,
  /^non ho (?:alcuna |nessuna )?(?:allergia|allergie|intolleranza|intolleranze)(?: e intolleranze)?$/,
  /^no non ho (?:alcuna |nessuna )?(?:allergia|allergie|intolleranza|intolleranze)(?: e intolleranze)?$/,
  /^no tengo (?:ninguna )?(?:alergia|alergias|intolerancia|intolerancias)$/,
  /^(?:nao tenho|sem) (?:nenhuma )?(?:alergia|alergias|intolerancia|intolerancias)$/,
  /^(?:ninguna|ninguno|nenhuma|nenhum) (?:alergia|alergias|intolerancia|intolerancias)$/,
  /^(?:aucune|pas de) (?:allergie|allergies|intolerance|intolerances)$/,
  /^(?:keine|geen) (?:allergie|allergien|allergieen|intoleranz|intoleranzen)$/,
] as const;

const FOOD_TEXT_PATTERNS: Record<
  (typeof FOOD_NEEDS_TEXT_FILTERS)[number],
  RegExp
> = {
  gluten_celiac:
    /\b(?:celiac\w*|celiach\w*|coeliac\w*|celiachia|gluten\w*|glutine)\b/,
  lactose_dairy:
    /\b(?:lactos\w*|lattos\w*|lattic\w*|dairy|milk|cheese|casein\w*|latte)\b/,
  nuts_peanuts:
    /\b(?:nut|nuts|peanut\w*|arachid\w*|walnut\w*|noci|nocciol\w*|pinol\w*|almond\w*|mandorl\w*|hazelnut\w*|cashew\w*|pistac\w*|pecan\w*|noix|noten)\b|\bfrutta secca\b/,
  fish_shellfish:
    /\b(?:fish|fishes|pesce|tonno|sgombro|seafood|shellfish|shrimp\w*|prawn\w*|garnaal\w*|cozz\w*|mussel\w*|vongol\w*|crostace\w*|mollusc\w*|mollusch\w*|gamber\w*|crab\w*|lobster\w*)\b/,
};

function normalizedToken(value: string): string {
  return value.trim().toLowerCase().replaceAll("’", "'");
}

function normalizedFreeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[’'`´]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function dietaryTokens(value: string | null | undefined): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => !ignoredDietaryValues.has(normalizedToken(item)));
}

export function parseFoodNeedsFilter(
  value: string | null | undefined,
): FoodNeedsFilter | null {
  const normalized = (value ?? "").trim();
  return foodNeedsFilterSet.has(normalized)
    ? (normalized as FoodNeedsFilter)
    : null;
}

export function parseDietarySelections(
  value: string | null | undefined,
): Array<(typeof ESIGENZE_ALIMENTARI_OPTIONS)[number]> {
  const tokens = new Set(dietaryTokens(value).map(normalizedToken));
  return ESIGENZE_ALIMENTARI_OPTIONS.filter((option) =>
    tokens.has(normalizedToken(option)),
  );
}

export function dietaryOtherDetails(
  value: string | null | undefined,
): string {
  const optionTokens = new Set(
    ESIGENZE_ALIMENTARI_OPTIONS.map((option) => normalizedToken(option)),
  );
  return dietaryTokens(value)
    .filter((token) => !optionTokens.has(normalizedToken(token)))
    .join(", ");
}

export function isNegativeFoodText(
  value: string | null | undefined,
): boolean {
  return negativeFoodTextValues.has(normalizedFreeText(value));
}

export function hasMeaningfulAllergyText(
  value: string | null | undefined,
): boolean {
  const normalized = normalizedFreeText(value);
  if (negativeFoodTextValues.has(normalized)) return false;
  return !negativeAllergyPatterns.some((pattern) => pattern.test(normalized));
}

export function meaningfulDietaryOtherDetails(
  value: string | null | undefined,
): string {
  const details = dietaryOtherDetails(value);
  return isNegativeFoodText(details) ? "" : details;
}

function foodAnalysisText(row: FoodNeedsParticipantRow): string {
  const dietaryDetails = meaningfulDietaryOtherDetails(
    row.esigenze_alimentari,
  );
  const allergies = hasMeaningfulAllergyText(row.allergie)
    ? row.allergie?.trim() ?? ""
    : "";
  return normalizedFreeText(`${dietaryDetails} ${allergies}`);
}

export function detectedFoodTextCategories(
  row: FoodNeedsParticipantRow,
): Array<(typeof FOOD_NEEDS_TEXT_FILTERS)[number]> {
  const text = foodAnalysisText(row);
  return FOOD_NEEDS_TEXT_FILTERS.filter((filter) =>
    FOOD_TEXT_PATTERNS[filter].test(text),
  );
}

export function hasFoodNeedsDeclaration(row: FoodNeedsParticipantRow): boolean {
  return Boolean(
    parseDietarySelections(row.esigenze_alimentari).length > 0 ||
      dietaryOtherDetails(row.esigenze_alimentari) ||
      hasMeaningfulAllergyText(row.allergie),
  );
}

export function matchesFoodNeedsFilter(
  row: FoodNeedsParticipantRow,
  filter: FoodNeedsFilter,
): boolean {
  if (filter === "allergies") return hasMeaningfulAllergyText(row.allergie);
  if ((FOOD_NEEDS_TEXT_FILTERS as readonly string[]).includes(filter)) {
    return detectedFoodTextCategories(row).includes(
      filter as (typeof FOOD_NEEDS_TEXT_FILTERS)[number],
    );
  }
  return parseDietarySelections(row.esigenze_alimentari).includes(
    OPTION_BY_FILTER[filter as DietaryOptionFilter],
  );
}

export function buildFoodNeedsSummary(
  rows: FoodNeedsParticipantRow[],
): Record<FoodNeedsFilter, number> {
  const summary = Object.fromEntries(
    FOOD_NEEDS_FILTERS.map((filter) => [filter, 0]),
  ) as Record<FoodNeedsFilter, number>;

  for (const row of rows) {
    for (const filter of FOOD_NEEDS_FILTERS) {
      if (matchesFoodNeedsFilter(row, filter)) summary[filter] += 1;
    }
  }

  return summary;
}

export function describeDietaryRequirements(
  row: FoodNeedsParticipantRow,
): string {
  const selections = parseDietarySelections(row.esigenze_alimentari);
  const details = dietaryOtherDetails(row.esigenze_alimentari);
  return [...selections, details].filter(Boolean).join("; ");
}
