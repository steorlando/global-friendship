export type ParticipantTemplateData = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  telefono: string | null;
  nazione: string | null;
  data_nascita: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  alloggio: string | null;
  allergie: string | null;
  esigenze_alimentari: string[];
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string[];
  quota_totale: number | null;
  group: string;
};

type TemplateField = {
  key: string;
  label: string;
  token: string;
};

export const PARTICIPANT_TEMPLATE_FIELDS: TemplateField[] = [
  { key: "full_name", label: "Full name", token: "{{full_name}}" },
  { key: "nome", label: "Name", token: "{{nome}}" },
  { key: "cognome", label: "Surname", token: "{{cognome}}" },
  { key: "id", label: "Id", token: "{{id}}" },
  { key: "email", label: "Email", token: "{{email}}" },
  { key: "telefono", label: "Phone", token: "{{telefono}}" },
  { key: "nazione", label: "Country", token: "{{nazione}}" },
  { key: "data_nascita", label: "Date of birth", token: "{{data_nascita}}" },
  { key: "data_arrivo", label: "Date of arrival", token: "{{data_arrivo}}" },
  { key: "data_partenza", label: "Date of departure", token: "{{data_partenza}}" },
  { key: "alloggio", label: "Accommodation", token: "{{alloggio}}" },
  { key: "group", label: "Group", token: "{{group}}" },
  { key: "allergie", label: "Allergies", token: "{{allergie}}" },
  {
    key: "esigenze_alimentari",
    label: "Dietary requirements",
    token: "{{esigenze_alimentari}}",
  },
  {
    key: "disabilita_accessibilita",
    label: "Accessibility support needed",
    token: "{{disabilita_accessibilita}}",
  },
  {
    key: "difficolta_accessibilita",
    label: "Accessibility details",
    token: "{{difficolta_accessibilita}}",
  },
  { key: "quota_totale", label: "Total fee", token: "{{quota_totale}}" },
];

function normalizeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function toCommaList(values: string[] | null | undefined): string {
  const cleaned = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.join(", ");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildParticipantTemplateMap(
  participant: ParticipantTemplateData
): Record<string, string> {
  const nome = normalizeString(participant.nome);
  const cognome = normalizeString(participant.cognome);
  const fullName = [nome, cognome].filter(Boolean).join(" ").trim();
  const quota = participant.quota_totale == null ? "" : String(participant.quota_totale);

  return {
    full_name: fullName,
    nome,
    cognome,
    id: participant.id ?? "",
    email: normalizeString(participant.email),
    telefono: normalizeString(participant.telefono),
    nazione: normalizeString(participant.nazione),
    data_nascita: normalizeString(participant.data_nascita),
    data_arrivo: normalizeString(participant.data_arrivo),
    data_partenza: normalizeString(participant.data_partenza),
    alloggio: normalizeString(participant.alloggio),
    group: normalizeString(participant.group),
    allergie: normalizeString(participant.allergie),
    esigenze_alimentari: toCommaList(participant.esigenze_alimentari),
    disabilita_accessibilita:
      participant.disabilita_accessibilita == null
        ? ""
        : participant.disabilita_accessibilita
          ? "Yes"
          : "No",
    difficolta_accessibilita: toCommaList(participant.difficolta_accessibilita),
    quota_totale: quota,
  };
}

function renderTemplate(
  template: string,
  values: Record<string, string>,
  transform: (value: string) => string
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const raw = values[key] ?? "";
    return transform(raw);
  });
}

export function renderParticipantTemplateText(
  template: string,
  participant: ParticipantTemplateData
): string {
  const values = buildParticipantTemplateMap(participant);
  return renderTemplate(template, values, (value) => value);
}

export function renderParticipantTemplateHtml(
  template: string,
  participant: ParticipantTemplateData
): string {
  const values = buildParticipantTemplateMap(participant);
  return renderTemplate(template, values, (value) => escapeHtml(value));
}

export function htmlToText(value: string): string {
  return value
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|li|h[1-6])\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
