import type {
  BandRole,
  SocialMediaTask,
  StaffArea,
} from "@/lib/partecipante/staff-availability";

export type StaffAvailabilityStatRow = {
  participant_id: string;
  areas: StaffArea[] | null;
  band_role: BandRole | null;
  band_instrument?: string | null;
  social_media_tasks: SocialMediaTask[] | null;
  social_media_other?: string | null;
  updated_at?: string | null;
};

export type StaffAvailabilitySummary = {
  responses: number;
  band: number;
  choir: number;
  socialMedia: number;
  bandVocals: number;
  bandInstrument: number;
  socialCapture: number;
  socialPostProduction: number;
  socialShortPosts: number;
  socialLongArticles: number;
  socialOther: number;
};

export const STAFF_AVAILABILITY_FILTERS = [
  "responses",
  "band",
  "choir",
  "social_media",
  "band_vocals",
  "band_instrument",
  "social_capture",
  "social_post_production",
  "social_short_posts",
  "social_long_articles",
  "social_other",
] as const;

export type StaffAvailabilityFilter =
  (typeof STAFF_AVAILABILITY_FILTERS)[number];

const staffAvailabilityFilterSet = new Set<string>(STAFF_AVAILABILITY_FILTERS);

export function parseStaffAvailabilityFilter(
  value: string | null | undefined,
): StaffAvailabilityFilter | null {
  const normalized = (value ?? "").trim();
  return staffAvailabilityFilterSet.has(normalized)
    ? (normalized as StaffAvailabilityFilter)
    : null;
}

export function matchesStaffAvailabilityFilter(
  row: StaffAvailabilityStatRow,
  filter: StaffAvailabilityFilter,
): boolean {
  const areas = row.areas ?? [];
  const socialTasks = row.social_media_tasks ?? [];

  switch (filter) {
    case "responses":
      return true;
    case "band":
      return areas.includes("band");
    case "choir":
      return areas.includes("choir");
    case "social_media":
      return areas.includes("social_media");
    case "band_vocals":
      return row.band_role === "vocals";
    case "band_instrument":
      return row.band_role === "instrument";
    case "social_capture":
      return socialTasks.includes("capture");
    case "social_post_production":
      return socialTasks.includes("post_production");
    case "social_short_posts":
      return socialTasks.includes("short_posts");
    case "social_long_articles":
      return socialTasks.includes("long_articles");
    case "social_other":
      return socialTasks.includes("other");
  }
}

export function emptyStaffAvailabilitySummary(): StaffAvailabilitySummary {
  return {
    responses: 0,
    band: 0,
    choir: 0,
    socialMedia: 0,
    bandVocals: 0,
    bandInstrument: 0,
    socialCapture: 0,
    socialPostProduction: 0,
    socialShortPosts: 0,
    socialLongArticles: 0,
    socialOther: 0,
  };
}

export function buildStaffAvailabilitySummary(
  rows: StaffAvailabilityStatRow[],
): StaffAvailabilitySummary {
  const summary = emptyStaffAvailabilitySummary();
  summary.responses = rows.length;

  for (const row of rows) {
    const areas = row.areas ?? [];
    const socialTasks = row.social_media_tasks ?? [];

    if (areas.includes("band")) summary.band += 1;
    if (areas.includes("choir")) summary.choir += 1;
    if (areas.includes("social_media")) summary.socialMedia += 1;
    if (row.band_role === "vocals") summary.bandVocals += 1;
    if (row.band_role === "instrument") summary.bandInstrument += 1;
    if (socialTasks.includes("capture")) summary.socialCapture += 1;
    if (socialTasks.includes("post_production")) summary.socialPostProduction += 1;
    if (socialTasks.includes("short_posts")) summary.socialShortPosts += 1;
    if (socialTasks.includes("long_articles")) summary.socialLongArticles += 1;
    if (socialTasks.includes("other")) summary.socialOther += 1;
  }

  return summary;
}

export function describeStaffAvailability(row: StaffAvailabilityStatRow): string {
  const descriptions: string[] = [];
  const areas = row.areas ?? [];
  const socialTasks = row.social_media_tasks ?? [];

  if (areas.includes("band")) {
    if (row.band_role === "vocals") descriptions.push("Band - canto");
    if (row.band_role === "instrument") {
      const instrument = (row.band_instrument ?? "").trim();
      descriptions.push(instrument ? `Band - strumento: ${instrument}` : "Band - strumento");
    }
  }
  if (areas.includes("choir")) {
    descriptions.push("Coro per la preghiera e la liturgia");
  }
  if (areas.includes("social_media")) {
    const socialDescriptions: string[] = [];
    if (socialTasks.includes("capture")) socialDescriptions.push("foto o video");
    if (socialTasks.includes("post_production")) socialDescriptions.push("montaggio foto o video");
    if (socialTasks.includes("short_posts")) socialDescriptions.push("post per i social");
    if (socialTasks.includes("long_articles")) socialDescriptions.push("articoli lunghi");
    if (socialTasks.includes("other")) {
      const other = (row.social_media_other ?? "").trim();
      socialDescriptions.push(other ? `altro: ${other}` : "altro");
    }
    descriptions.push(
      socialDescriptions.length > 0
        ? `Social media - ${socialDescriptions.join(", ")}`
        : "Social media",
    );
  }

  return descriptions.join("; ");
}
