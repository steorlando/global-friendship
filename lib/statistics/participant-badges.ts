import { Buffer } from "node:buffer";
import { jsPDF } from "jspdf";

export const PARTICIPANT_BADGE_WIDTH_MM = 100;
export const PARTICIPANT_BADGE_HEIGHT_MM = 150;

const FONT_FAMILY = "DejaVuSansCondensed";
const FONT_FILE_NAME = "DejaVuSansCondensed-Bold.ttf";
const BACKGROUND_ALIAS = "global-friendship-badge-v2";
const TEXT_X_MM = 17.2;
const TEXT_MAX_WIDTH_MM = 65.6;
const TEXT_COLOR: [number, number, number] = [25, 49, 85];

export type ParticipantBadgeRow = {
  id: string;
  nome: string | null;
  cognome: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  citta: string | null;
};

export type ParticipantBadgeContent = {
  id: string;
  fullName: string;
  community: string;
};

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

export function toParticipantBadgeContent(
  participant: ParticipantBadgeRow,
): ParticipantBadgeContent {
  const fullName = [participant.nome, participant.cognome]
    .map(normalizeText)
    .filter(Boolean)
    .join(" ");
  const country = normalizeText(
    participant.paese_residenza ?? participant.nazione,
  );
  const city = normalizeText(participant.citta);

  return {
    id: participant.id,
    fullName: fullName || "-",
    community: [country, city].filter(Boolean).join(", ") || "-",
  };
}

export function sortParticipantBadges(
  participants: ParticipantBadgeRow[],
): ParticipantBadgeRow[] {
  const collator = new Intl.Collator("it", {
    numeric: true,
    sensitivity: "base",
  });

  return [...participants].sort((a, b) => {
    const aCountry = normalizeText(a.paese_residenza ?? a.nazione);
    const bCountry = normalizeText(b.paese_residenza ?? b.nazione);
    const countryCompare = collator.compare(aCountry, bCountry);
    if (countryCompare !== 0) return countryCompare;

    const cityCompare = collator.compare(
      normalizeText(a.citta),
      normalizeText(b.citta),
    );
    if (cityCompare !== 0) return cityCompare;

    const firstNameCompare = collator.compare(
      normalizeText(a.nome),
      normalizeText(b.nome),
    );
    if (firstNameCompare !== 0) return firstNameCompare;

    return collator.compare(normalizeText(a.cognome), normalizeText(b.cognome));
  });
}

type FittedText = {
  fontSize: number;
  lines: string[];
};

function fitText(
  doc: jsPDF,
  text: string,
  options: {
    preferredFontSize: number;
    minimumFontSize: number;
    maxLines: number;
  },
): FittedText {
  for (
    let fontSize = options.preferredFontSize;
    fontSize >= options.minimumFontSize;
    fontSize -= 0.5
  ) {
    doc.setFontSize(fontSize);
    const lines = doc.splitTextToSize(text, TEXT_MAX_WIDTH_MM) as string[];
    if (
      lines.length <= options.maxLines &&
      lines.every((line) => doc.getTextWidth(line) <= TEXT_MAX_WIDTH_MM + 0.1)
    ) {
      return { fontSize, lines };
    }
  }

  doc.setFontSize(options.minimumFontSize);
  const lines = doc.splitTextToSize(text, TEXT_MAX_WIDTH_MM) as string[];
  return {
    fontSize: options.minimumFontSize,
    lines: lines.slice(0, options.maxLines),
  };
}

function drawBadgeText(doc: jsPDF, badge: ParticipantBadgeContent) {
  doc.setFont(FONT_FAMILY, "bold");
  doc.setTextColor(...TEXT_COLOR);

  doc.setFontSize(17.5);
  const preferredNameLines = doc.splitTextToSize(
    badge.fullName,
    TEXT_MAX_WIDTH_MM,
  ) as string[];
  if (preferredNameLines.length === 1) {
    const fittedName = fitText(doc, badge.fullName, {
      preferredFontSize: 17.5,
      minimumFontSize: 10.5,
      maxLines: 1,
    });
    doc.setFontSize(fittedName.fontSize);
    doc.text(fittedName.lines[0], TEXT_X_MM, 52);
  } else {
    const fittedName = fitText(doc, badge.fullName, {
      preferredFontSize: 14,
      minimumFontSize: 10.5,
      maxLines: 2,
    });
    doc.setFontSize(fittedName.fontSize);
    doc.text(fittedName.lines, TEXT_X_MM, 49.1, {
      lineHeightFactor: 1,
    });
  }

  const fittedCommunity = fitText(doc, badge.community, {
    preferredFontSize: 13,
    minimumFontSize: 10,
    maxLines: 1,
  });
  doc.setFontSize(fittedCommunity.fontSize);
  doc.text(fittedCommunity.lines[0], TEXT_X_MM, 66);
}

export function buildParticipantBadgesPdf(args: {
  participants: ParticipantBadgeRow[];
  backgroundJpeg: Uint8Array;
  fontTtf: Uint8Array;
}): Uint8Array {
  if (args.participants.length === 0) {
    throw new Error("No active participants found");
  }

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [PARTICIPANT_BADGE_WIDTH_MM, PARTICIPANT_BADGE_HEIGHT_MM],
    compress: true,
    putOnlyUsedFonts: true,
    floatPrecision: 4,
  });

  doc.setProperties({
    title: "Global Friendship 2026 - Participant badges",
    subject: "Print-ready participant badges",
    author: "Global Friendship",
    creator: "Global Friendship App",
  });
  doc.addFileToVFS(FONT_FILE_NAME, Buffer.from(args.fontTtf).toString("base64"));
  doc.addFont(FONT_FILE_NAME, FONT_FAMILY, "bold");

  const badges = sortParticipantBadges(args.participants).map(
    toParticipantBadgeContent,
  );

  badges.forEach((badge, index) => {
    if (index > 0) {
      doc.addPage(
        [PARTICIPANT_BADGE_WIDTH_MM, PARTICIPANT_BADGE_HEIGHT_MM],
        "portrait",
      );
    }
    doc.addImage(
      args.backgroundJpeg,
      "JPEG",
      0,
      0,
      PARTICIPANT_BADGE_WIDTH_MM,
      PARTICIPANT_BADGE_HEIGHT_MM,
      BACKGROUND_ALIAS,
      "FAST",
    );
    drawBadgeText(doc, badge);
  });

  return new Uint8Array(doc.output("arraybuffer"));
}
