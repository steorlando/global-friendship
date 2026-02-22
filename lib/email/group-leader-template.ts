export type GroupLeaderTemplateData = {
  id: string;
  nome: string | null;
  cognome: string | null;
  email: string | null;
  telefono: string | null;
  ruolo: string | null;
  italia: boolean | null;
  roma: boolean | null;
  gruppi: string[];
};

type TemplateField = {
  key: string;
  label: string;
  token: string;
};

export const GROUP_LEADER_TEMPLATE_FIELDS: TemplateField[] = [
  { key: "full_name", label: "Full name", token: "{{full_name}}" },
  { key: "nome", label: "Name", token: "{{nome}}" },
  { key: "cognome", label: "Surname", token: "{{cognome}}" },
  { key: "id", label: "Id", token: "{{id}}" },
  { key: "email", label: "Email", token: "{{email}}" },
  { key: "telefono", label: "Phone", token: "{{telefono}}" },
  { key: "ruolo", label: "Role", token: "{{ruolo}}" },
  { key: "gruppi", label: "Groups", token: "{{gruppi}}" },
  { key: "italia", label: "Based in Italy", token: "{{italia}}" },
  { key: "roma", label: "Based in Rome", token: "{{roma}}" },
];

function normalizeString(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function toCommaList(values: string[] | null | undefined): string {
  const cleaned = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return cleaned.join(", ");
}

function buildTemplateMap(groupLeader: GroupLeaderTemplateData): Record<string, string> {
  const nome = normalizeString(groupLeader.nome);
  const cognome = normalizeString(groupLeader.cognome);
  const fullName = [nome, cognome].filter(Boolean).join(" ").trim();

  return {
    full_name: fullName,
    nome,
    cognome,
    id: groupLeader.id ?? "",
    email: normalizeString(groupLeader.email),
    telefono: normalizeString(groupLeader.telefono),
    ruolo: normalizeString(groupLeader.ruolo),
    gruppi: toCommaList(groupLeader.gruppi),
    italia: groupLeader.italia == null ? "" : groupLeader.italia ? "Yes" : "No",
    roma: groupLeader.roma == null ? "" : groupLeader.roma ? "Yes" : "No",
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

export function renderGroupLeaderTemplateText(
  template: string,
  groupLeader: GroupLeaderTemplateData
): string {
  return renderTemplate(template, buildTemplateMap(groupLeader), (value) => value);
}

export function renderGroupLeaderTemplateHtml(
  template: string,
  groupLeader: GroupLeaderTemplateData
): string {
  return renderTemplate(template, buildTemplateMap(groupLeader), (value) => escapeHtml(value));
}
