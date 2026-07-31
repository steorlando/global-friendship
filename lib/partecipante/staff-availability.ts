export const STAFF_AREAS = ["band", "choir", "social_media"] as const;
export const BAND_ROLES = ["vocals", "instrument"] as const;
export const SOCIAL_MEDIA_TASKS = [
  "capture",
  "post_production",
  "short_posts",
  "long_articles",
  "other",
] as const;

export type StaffArea = (typeof STAFF_AREAS)[number];
export type BandRole = (typeof BAND_ROLES)[number];
export type SocialMediaTask = (typeof SOCIAL_MEDIA_TASKS)[number];

export type ParticipantStaffAvailability = {
  areas: StaffArea[];
  bandRole: BandRole | null;
  bandInstrument: string | null;
  socialMediaTasks: SocialMediaTask[];
  socialMediaOther: string | null;
  updatedAt: string | null;
};

export type ParticipantStaffAvailabilityInput = Omit<
  ParticipantStaffAvailability,
  "updatedAt"
>;

type ValidationResult =
  | { ok: true; value: ParticipantStaffAvailabilityInput }
  | { ok: false; error: string };

const staffAreaSet = new Set<string>(STAFF_AREAS);
const bandRoleSet = new Set<string>(BAND_ROLES);
const socialMediaTaskSet = new Set<string>(SOCIAL_MEDIA_TASKS);

function normalizeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

function normalizeEnumArray<T extends string>(
  value: unknown,
  allowed: Set<string>
): T[] | null {
  if (!Array.isArray(value)) return null;
  const normalized = value.map((item) =>
    typeof item === "string" ? item.trim() : ""
  );
  if (normalized.some((item) => !allowed.has(item))) return null;
  return [...new Set(normalized)] as T[];
}

export function normalizeParticipantStaffAvailabilityInput(
  value: unknown
): ValidationResult {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, error: "Invalid staff availability payload" };
  }

  const input = value as Record<string, unknown>;
  const areas = normalizeEnumArray<StaffArea>(input.areas, staffAreaSet);
  if (!areas || areas.length === 0) {
    return { ok: false, error: "Select at least one staff area" };
  }

  const includesBand = areas.includes("band");
  const rawBandRole = normalizeString(input.bandRole, 30);
  const bandRole = rawBandRole && bandRoleSet.has(rawBandRole)
    ? (rawBandRole as BandRole)
    : null;
  if (includesBand && !bandRole) {
    return { ok: false, error: "Choose whether you want to sing or play an instrument" };
  }

  const rawInstrument = normalizeString(input.bandInstrument, 120);
  if (includesBand && bandRole === "instrument" && !rawInstrument) {
    return { ok: false, error: "Indicate which instrument you can play" };
  }

  const includesSocialMedia = areas.includes("social_media");
  const socialMediaTasks = normalizeEnumArray<SocialMediaTask>(
    input.socialMediaTasks,
    socialMediaTaskSet
  );
  if (!socialMediaTasks) {
    return { ok: false, error: "Invalid social media preference" };
  }
  if (includesSocialMedia && socialMediaTasks.length === 0) {
    return { ok: false, error: "Select at least one social media activity" };
  }

  const rawSocialMediaOther = normalizeString(input.socialMediaOther, 500);
  if (
    includesSocialMedia &&
    socialMediaTasks.includes("other") &&
    !rawSocialMediaOther
  ) {
    return { ok: false, error: "Describe the other social media activity" };
  }

  return {
    ok: true,
    value: {
      areas,
      bandRole: includesBand ? bandRole : null,
      bandInstrument:
        includesBand && bandRole === "instrument" ? rawInstrument : null,
      socialMediaTasks: includesSocialMedia ? socialMediaTasks : [],
      socialMediaOther:
        includesSocialMedia && socialMediaTasks.includes("other")
          ? rawSocialMediaOther
          : null,
    },
  };
}
