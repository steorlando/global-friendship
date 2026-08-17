const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TOUR_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const TOUR_ATTACHMENT_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export type TourInput = {
  title: string;
  description: string;
  maxParticipants: number;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  isActive: boolean;
};

function optionalText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
}

export function parseTourInput(value: unknown): TourInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const title = optionalText(body.title, 160);
  const description = optionalText(body.description, 5000);
  const maxParticipants = Number(body.maxParticipants);
  const contactEmail = optionalText(body.contactEmail, 320);

  if (!title) throw new Error("TOUR_TITLE_REQUIRED");
  if (!description) throw new Error("TOUR_DESCRIPTION_REQUIRED");
  if (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 10000) {
    throw new Error("TOUR_CAPACITY_INVALID");
  }
  if (contactEmail && !EMAIL_REGEX.test(contactEmail)) {
    throw new Error("TOUR_CONTACT_EMAIL_INVALID");
  }

  return {
    title,
    description,
    maxParticipants,
    contactName: optionalText(body.contactName, 160),
    contactPhone: optionalText(body.contactPhone, 80),
    contactEmail,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  };
}

export function validateTourAttachment(file: File): void {
  if (!file.name.trim()) throw new Error("TOUR_ATTACHMENT_NAME_REQUIRED");
  if (file.size < 1 || file.size > TOUR_ATTACHMENT_MAX_BYTES) {
    throw new Error("TOUR_ATTACHMENT_SIZE_INVALID");
  }
  if (!TOUR_ATTACHMENT_MIME_TYPES.has(file.type)) {
    throw new Error("TOUR_ATTACHMENT_TYPE_INVALID");
  }
}

export function safeAttachmentFileName(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
  return normalized || "tour-attachment";
}

export function tourApiErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const knownCodes = [
    "TOUR_TITLE_REQUIRED",
    "TOUR_DESCRIPTION_REQUIRED",
    "TOUR_CAPACITY_INVALID",
    "TOUR_CONTACT_EMAIL_INVALID",
    "TOUR_ATTACHMENT_NAME_REQUIRED",
    "TOUR_ATTACHMENT_SIZE_INVALID",
    "TOUR_ATTACHMENT_TYPE_INVALID",
    "TOUR_REGISTRATION_HIDDEN",
    "TOUR_BOOKINGS_CLOSED",
    "TOUR_NOT_FOUND",
    "TOUR_FULL",
    "TOUR_AVAILABLE",
    "TOUR_ALREADY_BOOKED",
    "TOUR_OFFER_EXPIRED",
    "TOUR_RESERVED_FOR_WAITLIST",
    "TOUR_CAPACITY_BELOW_OCCUPANCY",
    "PARTICIPANT_NOT_FOUND",
  ];
  return knownCodes.find((code) => message.includes(code)) ?? "TOUR_OPERATION_FAILED";
}
