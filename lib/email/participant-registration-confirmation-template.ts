export type ParticipantRegistrationConfirmationData = {
  nome: string | null;
  cognome: string | null;
  email: string | null;
  emailSecondaria: string | null;
  telefono: string | null;
  nazione: string | null;
  paeseResidenza: string | null;
  citta: string | null;
  tipoIscrizione: string | null;
  sesso: string | null;
  dataNascita: string | null;
  dataArrivo: string | null;
  dataPartenza: string | null;
  alloggio: string | null;
  esigenzeAlimentari: string | null;
  allergie: string | null;
  disabilitaAccessibilita: boolean | null;
  difficoltaAccessibilita: string | null;
  partecipaInteroEvento: boolean | null;
  presenzaDettaglio: Record<string, unknown> | null;
  gruppoId: string | null;
  gruppoLabel: string | null;
  note: string | null;
};

function clean(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function formatBool(value: boolean | null | undefined): string {
  if (value == null) return "";
  return value ? "Yes" : "No";
}

function formatPresenceDettaglio(value: Record<string, unknown> | null): string {
  if (!value || typeof value !== "object") return "";
  const entries = Object.entries(value)
    .map(([key, raw]) => {
      const k = clean(key);
      if (!k) return "";

      if (typeof raw === "boolean") {
        return `${k}: ${raw ? "Yes" : "No"}`;
      }

      const normalized = clean(raw == null ? "" : String(raw));
      if (!normalized) return "";
      return `${k}: ${normalized}`;
    })
    .filter(Boolean);

  return entries.join(" | ");
}

function addSummaryLine(lines: string[], label: string, value: string) {
  const normalized = clean(value);
  if (!normalized) return;
  lines.push(`- ${label}: ${normalized}`);
}

function fullName(data: ParticipantRegistrationConfirmationData): string {
  return [clean(data.nome), clean(data.cognome)].filter(Boolean).join(" ").trim();
}

export function buildParticipantRegistrationConfirmationSubject(
  data: ParticipantRegistrationConfirmationData
): string {
  const name = fullName(data);
  return name ? `Registration received: ${name}` : "Registration received";
}

export function buildParticipantRegistrationConfirmationText(
  data: ParticipantRegistrationConfirmationData
): string {
  const greetingName = fullName(data) || "Participant";
  const group = clean(data.gruppoLabel) || clean(data.gruppoId);
  const presenceDettaglio = formatPresenceDettaglio(data.presenzaDettaglio);
  const summaryLines: string[] = [];

  addSummaryLine(summaryLines, "First name", data.nome ?? "");
  addSummaryLine(summaryLines, "Last name", data.cognome ?? "");
  addSummaryLine(summaryLines, "Email", data.email ?? "");
  addSummaryLine(summaryLines, "Secondary email", data.emailSecondaria ?? "");
  addSummaryLine(summaryLines, "Phone", data.telefono ?? "");
  addSummaryLine(summaryLines, "Nationality", data.nazione ?? "");
  addSummaryLine(summaryLines, "Country of residence", data.paeseResidenza ?? "");
  addSummaryLine(summaryLines, "City", data.citta ?? "");
  addSummaryLine(summaryLines, "Registration type", data.tipoIscrizione ?? "");
  addSummaryLine(summaryLines, "Sex", data.sesso ?? "");
  addSummaryLine(summaryLines, "Date of birth", data.dataNascita ?? "");
  addSummaryLine(summaryLines, "Date of arrival", data.dataArrivo ?? "");
  addSummaryLine(summaryLines, "Date of departure", data.dataPartenza ?? "");
  addSummaryLine(summaryLines, "Accommodation", data.alloggio ?? "");
  addSummaryLine(summaryLines, "Dietary requirements", data.esigenzeAlimentari ?? "");
  addSummaryLine(summaryLines, "Allergies", data.allergie ?? "");
  addSummaryLine(
    summaryLines,
    "Accessibility support needed",
    formatBool(data.disabilitaAccessibilita)
  );
  addSummaryLine(
    summaryLines,
    "Accessibility details",
    data.difficoltaAccessibilita ?? ""
  );
  addSummaryLine(
    summaryLines,
    "Attending full event",
    formatBool(data.partecipaInteroEvento)
  );
  addSummaryLine(summaryLines, "Presence details", presenceDettaglio);
  addSummaryLine(summaryLines, "Group", group);
  addSummaryLine(summaryLines, "Notes", data.note ?? "");

  const summaryBlock =
    summaryLines.length > 0
      ? summaryLines.join("\n")
      : "- Your registration has been saved successfully.";

  return [
    `Hello ${greetingName},`,
    "",
    "We have received your registration successfully.",
    "",
    "Here is a summary of the data you submitted:",
    summaryBlock,
    "",
    "You can update your registration details later by returning to:",
    "https://portal.globalfriendship.eu",
    "",
    `To access and edit your data, use the same email address you registered with: ${clean(data.email) || "-"}`,
    "",
    "Global Friendship",
  ].join("\n");
}
