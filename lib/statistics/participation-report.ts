import { Buffer } from "node:buffer";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export type ParticipationParticipant = {
  id: string;
  nome: string | null;
  cognome: string | null;
  tipo_iscrizione: string | null;
  paese_residenza: string | null;
  nazione: string | null;
  citta: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
};

export type PreviousParticipationSnapshot = {
  year: number;
  source: {
    file: string;
    sheet: string;
    rows: number;
  };
  categoryCounts: Record<string, number>;
  youngByCountry: Record<string, number>;
  youngByItalianCity: Record<string, number>;
  youngByRomeGroup: Record<string, number>;
};

export type PreviousWorkbookRow = {
  type?: unknown;
  country?: unknown;
  city?: unknown;
  gruppo_roma?: unknown;
};

export type ParticipationReportFonts = {
  regular: Uint8Array;
  bold: Uint8Array;
};

type RegistrationBucket =
  | "higherStudents"
  | "universityWorker"
  | "operator"
  | "driver"
  | "other";

type CurrentPivotRow = {
  key: string;
  label: string;
  higherStudents: number;
  universityWorker: number;
  operator: number;
  total: number;
};

export type ComparisonRow = {
  key: string;
  label: string;
  previous: number | null;
  current: number | null;
  absoluteChange: number | null;
  percentageChange: number | null;
};

export type OperatorRow = {
  id: string;
  country: string;
  city: string;
  firstName: string;
  lastName: string;
  fullName: string;
};

export type ParticipationReportModel = {
  summary: {
    active: number;
    activeWithoutDrivers: number;
    higherStudents: number;
    universityWorker: number;
    young: number;
    operators: number;
    drivers: number;
    reported: number;
  };
  current: {
    countryRows: CurrentPivotRow[];
    italianCityRows: CurrentPivotRow[];
    romeGroupRows: CurrentPivotRow[];
  };
  comparison: {
    countryRows: ComparisonRow[];
    italianCityRows: ComparisonRow[];
    romeGroupRows: ComparisonRow[];
  };
  operators: OperatorRow[];
};

type CanonicalLabel = {
  key: string;
  label: string;
};

type MutablePivotRow = {
  key: string;
  label: string;
  higherStudents: number;
  universityWorker: number;
  operator: number;
};

const FONT_FAMILY = "DejaVuSansCondensed";
const FONT_REGULAR_FILE = "DejaVuSansCondensed.ttf";
const FONT_BOLD_FILE = "DejaVuSansCondensed-Bold.ttf";
const PAGE_FORMAT = "a4";
const MARGIN_X = 12;
const FOOTER_Y = 204;
const COLORS = {
  navy: [23, 59, 101] as [number, number, number],
  blue: [37, 99, 235] as [number, number, number],
  teal: [15, 118, 110] as [number, number, number],
  ink: [15, 23, 42] as [number, number, number],
  muted: [71, 85, 105] as [number, number, number],
  line: [203, 213, 225] as [number, number, number],
  paleBlue: [239, 246, 255] as [number, number, number],
  paleTeal: [240, 253, 250] as [number, number, number],
  paleSlate: [248, 250, 252] as [number, number, number],
  positive: [21, 128, 61] as [number, number, number],
  negative: [185, 28, 28] as [number, number, number],
};

const COUNTRY_LABELS = new Map<string, CanonicalLabel>([
  ["argentina", { key: "argentina", label: "Argentina" }],
  ["austria", { key: "austria", label: "Austria" }],
  ["belgium", { key: "belgium", label: "Belgio" }],
  ["belgio", { key: "belgium", label: "Belgio" }],
  ["colombia", { key: "colombia", label: "Colombia" }],
  ["czech republic", { key: "czech-republic", label: "Repubblica Ceca" }],
  ["repubblica ceca", { key: "czech-republic", label: "Repubblica Ceca" }],
  ["denmark", { key: "denmark", label: "Danimarca" }],
  ["dinamarca", { key: "denmark", label: "Danimarca" }],
  ["france", { key: "france", label: "Francia" }],
  ["francia", { key: "france", label: "Francia" }],
  ["germany", { key: "germany", label: "Germania" }],
  ["germania", { key: "germany", label: "Germania" }],
  ["guatemala", { key: "guatemala", label: "Guatemala" }],
  ["holland", { key: "netherlands", label: "Paesi Bassi" }],
  ["netherlands", { key: "netherlands", label: "Paesi Bassi" }],
  ["paesi bassi", { key: "netherlands", label: "Paesi Bassi" }],
  ["honduras", { key: "honduras", label: "Honduras" }],
  ["hungary", { key: "hungary", label: "Ungheria" }],
  ["ungheria", { key: "hungary", label: "Ungheria" }],
  ["italia", { key: "italy", label: "Italia" }],
  ["italy", { key: "italy", label: "Italia" }],
  ["mexico", { key: "mexico", label: "Messico" }],
  ["messico", { key: "mexico", label: "Messico" }],
  ["peru", { key: "peru", label: "Perù" }],
  ["poland", { key: "poland", label: "Polonia" }],
  ["polonia", { key: "poland", label: "Polonia" }],
  ["portugal", { key: "portugal", label: "Portogallo" }],
  ["portogallo", { key: "portugal", label: "Portogallo" }],
  ["romania", { key: "romania", label: "Romania" }],
  ["russian federation", { key: "russia", label: "Federazione Russa" }],
  ["russia", { key: "russia", label: "Federazione Russa" }],
  ["slovakia", { key: "slovakia", label: "Slovacchia" }],
  ["slovacchia", { key: "slovakia", label: "Slovacchia" }],
  ["spain", { key: "spain", label: "Spagna" }],
  ["spagna", { key: "spain", label: "Spagna" }],
  ["ukraine", { key: "ukraine", label: "Ucraina" }],
  ["ucraina", { key: "ukraine", label: "Ucraina" }],
  ["united kingdom", { key: "united-kingdom", label: "Regno Unito" }],
  ["regno unito", { key: "united-kingdom", label: "Regno Unito" }],
]);

const ROME_GROUP_ALIASES = new Map<string, string>([
  ["liceali garbatella", "Garbatella"],
  ["universitari garbatella", "Garbatella"],
  ["liceali laurentino", "Laurentino"],
  ["universitari laurentino", "Laurentino"],
  ["liceali nomentano", "Nomentano"],
  ["liceali tor bella monaca", "Tor Bella Monaca"],
  ["superiori tor bella monaca", "Tor Bella Monaca"],
  ["san bartolomeo scuola", "San Bartolomeo"],
  ["superiori trastevere", "Trastevere"],
  ["superiori tuscolano", "Tuscolano"],
  ["superiori primavalle", "Primavalle liceali"],
  ["universitari primavalle", "Primavalle"],
  ["trastevere scuola italiano", "Trastevere - Scuola di Italiano"],
  ["trastevere scuola di italiano", "Trastevere - Scuola di Italiano"],
]);

const COMPARISON_EXCLUDED_COUNTRY_KEYS = new Set([
  "colombia",
  "guatemala",
  "honduras",
]);

const COLLATOR = new Intl.Collator("it", {
  numeric: true,
  sensitivity: "base",
});

function cleanText(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function normalizedKey(value: unknown): string {
  return cleanText(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("it")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function registrationBucket(value: unknown): RegistrationBucket {
  const normalized = normalizedKey(value);
  if (normalized.includes("driver autista")) return "driver";
  if (normalized.includes("higher student")) return "higherStudents";
  if (
    normalized.includes("undergraduate") ||
    normalized.includes("worker lavoratore")
  ) {
    return "universityWorker";
  }
  if (normalized.includes("operator operatore")) return "operator";
  return "other";
}

function canonicalCountry(value: unknown): CanonicalLabel {
  const raw = cleanText(value);
  const key = normalizedKey(raw);
  return (
    COUNTRY_LABELS.get(key) ?? {
      key: key || "country-not-provided",
      label: raw || "Paese non indicato",
    }
  );
}

function canonicalCity(value: unknown): CanonicalLabel {
  const raw = cleanText(value);
  const key = normalizedKey(raw);
  if (key === "roma" || key === "rome") {
    return { key: "roma", label: "Roma" };
  }
  return {
    key: key || "city-not-provided",
    label: raw || "Città non indicata",
  };
}

function canonicalRomeGroup(value: unknown): CanonicalLabel {
  const raw = cleanText(value);
  const normalized = normalizedKey(raw);
  const alias = ROME_GROUP_ALIASES.get(normalized);
  const label = alias ?? (raw || "Gruppo non indicato");
  return {
    key: normalizedKey(label) || "group-not-provided",
    label,
  };
}

function participantCountry(participant: ParticipationParticipant): string {
  return cleanText(participant.paese_residenza) || cleanText(participant.nazione);
}

function participantGroup(participant: ParticipationParticipant): string {
  return cleanText(participant.gruppo_label) || cleanText(participant.gruppo_id);
}

function addPivotCount(
  rows: Map<string, MutablePivotRow>,
  label: CanonicalLabel,
  bucket: RegistrationBucket,
) {
  if (
    bucket !== "higherStudents" &&
    bucket !== "universityWorker" &&
    bucket !== "operator"
  ) {
    return;
  }

  const row = rows.get(label.key) ?? {
    key: label.key,
    label: label.label,
    higherStudents: 0,
    universityWorker: 0,
    operator: 0,
  };
  row[bucket] += 1;
  rows.set(label.key, row);
}

function finalizePivotRows(rows: Map<string, MutablePivotRow>): CurrentPivotRow[] {
  return [...rows.values()]
    .map((row) => ({
      ...row,
      total: row.higherStudents + row.universityWorker + row.operator,
    }))
    .sort((a, b) => COLLATOR.compare(a.label, b.label));
}

function youngMapFromPivotRows(rows: CurrentPivotRow[]): Map<string, CanonicalLabel & { count: number }> {
  return new Map(
    rows
      .map((row) => ({
        key: row.key,
        label: row.label,
        count: row.higherStudents + row.universityWorker,
      }))
      .filter((row) => row.count > 0)
      .map((row) => [row.key, row]),
  );
}

function canonicalizeCountRecord(
  source: Record<string, number>,
  canonicalize: (label: string) => CanonicalLabel,
): Map<string, CanonicalLabel & { count: number }> {
  const result = new Map<string, CanonicalLabel & { count: number }>();
  for (const [rawLabel, rawCount] of Object.entries(source)) {
    const count = Number(rawCount);
    if (!Number.isFinite(count) || count <= 0) continue;
    const canonical = canonicalize(rawLabel);
    const previous = result.get(canonical.key);
    result.set(canonical.key, {
      ...canonical,
      count: (previous?.count ?? 0) + count,
    });
  }
  return result;
}

function buildComparisonRows(
  previous: Map<string, CanonicalLabel & { count: number }>,
  current: Map<string, CanonicalLabel & { count: number }>,
): ComparisonRow[] {
  const keys = new Set([...previous.keys(), ...current.keys()]);
  return [...keys]
    .map((key) => {
      const previousRow = previous.get(key);
      const currentRow = current.get(key);
      const previousCount = previousRow?.count ?? null;
      const currentCount = currentRow?.count ?? null;
      const bothPresent = previousCount !== null && currentCount !== null;
      const absoluteChange = bothPresent ? currentCount - previousCount : null;
      const percentageChange =
        bothPresent && previousCount !== 0
          ? (absoluteChange as number) / previousCount
          : null;

      return {
        key,
        label: currentRow?.label ?? previousRow?.label ?? key,
        previous: previousCount,
        current: currentCount,
        absoluteChange,
        percentageChange,
      };
    })
    .sort((a, b) => COLLATOR.compare(a.label, b.label));
}

export function buildPreviousParticipationSnapshotFromRows(args: {
  rows: PreviousWorkbookRow[];
  year: number;
  sourceFile: string;
  sheetName: string;
}): PreviousParticipationSnapshot {
  const categoryCounts: Record<string, number> = {
    higherStudents: 0,
    universityWorker: 0,
    operator: 0,
    driver: 0,
    other: 0,
  };
  const youngByCountry: Record<string, number> = {};
  const youngByItalianCity: Record<string, number> = {};
  const youngByRomeGroup: Record<string, number> = {};

  for (const row of args.rows) {
    const bucket = registrationBucket(row.type);
    categoryCounts[bucket] = (categoryCounts[bucket] ?? 0) + 1;
    if (bucket !== "higherStudents" && bucket !== "universityWorker") continue;

    const country = cleanText(row.country);
    const city = cleanText(row.city);
    if (country) youngByCountry[country] = (youngByCountry[country] ?? 0) + 1;
    if (canonicalCountry(country).key === "italy" && city) {
      youngByItalianCity[city] = (youngByItalianCity[city] ?? 0) + 1;
    }
    if (canonicalCity(city).key === "roma") {
      const group = cleanText(row.gruppo_roma);
      if (group) youngByRomeGroup[group] = (youngByRomeGroup[group] ?? 0) + 1;
    }
  }

  return {
    year: args.year,
    source: {
      file: args.sourceFile,
      sheet: args.sheetName,
      rows: args.rows.length,
    },
    categoryCounts,
    youngByCountry,
    youngByItalianCity,
    youngByRomeGroup,
  };
}

export function buildParticipationReportModel(args: {
  participants: ParticipationParticipant[];
  previous: PreviousParticipationSnapshot;
}): ParticipationReportModel {
  const countryPivot = new Map<string, MutablePivotRow>();
  const italianCityPivot = new Map<string, MutablePivotRow>();
  const romeGroupPivot = new Map<string, MutablePivotRow>();
  const summary = {
    active: args.participants.length,
    activeWithoutDrivers: 0,
    higherStudents: 0,
    universityWorker: 0,
    young: 0,
    operators: 0,
    drivers: 0,
    reported: 0,
  };
  const operators: OperatorRow[] = [];

  for (const participant of args.participants) {
    const bucket = registrationBucket(participant.tipo_iscrizione);
    if (bucket === "higherStudents") summary.higherStudents += 1;
    if (bucket === "universityWorker") summary.universityWorker += 1;
    if (bucket === "operator") summary.operators += 1;
    if (bucket === "driver") summary.drivers += 1;

    const country = canonicalCountry(participantCountry(participant));
    addPivotCount(countryPivot, country, bucket);

    const city = canonicalCity(participant.citta);
    if (country.key === "italy" && city.key !== "city-not-provided") {
      addPivotCount(italianCityPivot, city, bucket);
    }
    if (city.key === "roma") {
      addPivotCount(
        romeGroupPivot,
        canonicalRomeGroup(participantGroup(participant)),
        bucket,
      );
    }

    if (bucket === "operator") {
      const firstName = cleanText(participant.nome) || "Nome non indicato";
      const lastName = cleanText(participant.cognome) || "Cognome non indicato";
      operators.push({
        id: participant.id,
        country: country.label,
        city: city.label,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
      });
    }
  }

  summary.young = summary.higherStudents + summary.universityWorker;
  summary.reported = summary.young + summary.operators;
  summary.activeWithoutDrivers = summary.active - summary.drivers;

  operators.sort((a, b) => {
    const country = COLLATOR.compare(a.country, b.country);
    if (country !== 0) return country;
    const city = COLLATOR.compare(a.city, b.city);
    if (city !== 0) return city;
    const firstName = COLLATOR.compare(a.firstName, b.firstName);
    if (firstName !== 0) return firstName;
    const surname = COLLATOR.compare(a.lastName, b.lastName);
    if (surname !== 0) return surname;
    return COLLATOR.compare(a.id, b.id);
  });

  const countryRows = finalizePivotRows(countryPivot);
  const italianCityRows = finalizePivotRows(italianCityPivot);
  const romeGroupRows = finalizePivotRows(romeGroupPivot).filter(
    (row) => row.key !== "marconi",
  );

  const previousCountries = canonicalizeCountRecord(
    args.previous.youngByCountry,
    canonicalCountry,
  );
  const previousItalianCities = canonicalizeCountRecord(
    args.previous.youngByItalianCity,
    canonicalCity,
  );
  const previousRomeGroups = canonicalizeCountRecord(
    args.previous.youngByRomeGroup,
    canonicalRomeGroup,
  );

  return {
    summary,
    current: {
      countryRows,
      italianCityRows,
      romeGroupRows,
    },
    comparison: {
      countryRows: buildComparisonRows(
        previousCountries,
        youngMapFromPivotRows(countryRows),
      ).filter((row) => !COMPARISON_EXCLUDED_COUNTRY_KEYS.has(row.key)),
      italianCityRows: buildComparisonRows(
        previousItalianCities,
        youngMapFromPivotRows(italianCityRows),
      ),
      romeGroupRows: buildComparisonRows(
        previousRomeGroups,
        youngMapFromPivotRows(romeGroupRows),
      ),
    },
    operators,
  };
}

function registerFonts(doc: jsPDF, fonts: ParticipationReportFonts) {
  doc.addFileToVFS(
    FONT_REGULAR_FILE,
    Buffer.from(fonts.regular).toString("base64"),
  );
  doc.addFont(FONT_REGULAR_FILE, FONT_FAMILY, "normal");
  doc.addFileToVFS(
    FONT_BOLD_FILE,
    Buffer.from(fonts.bold).toString("base64"),
  );
  doc.addFont(FONT_BOLD_FILE, FONT_FAMILY, "bold");
  doc.setFont(FONT_FAMILY, "normal");
}

function addLandscapePage(doc: jsPDF) {
  doc.addPage(PAGE_FORMAT, "landscape");
}

function drawPageTitle(
  doc: jsPDF,
  title: string,
  subtitle?: string,
  y = 17,
): number {
  doc.setTextColor(...COLORS.navy);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(18);
  doc.text(title, MARGIN_X, y);
  let cursorY = y + 5;
  if (subtitle) {
    doc.setTextColor(...COLORS.muted);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(
      subtitle,
      doc.internal.pageSize.getWidth() - MARGIN_X * 2,
    ) as string[];
    doc.text(lines, MARGIN_X, cursorY);
    cursorY += lines.length * 3.7;
  }
  return cursorY;
}

function drawSectionTitle(doc: jsPDF, title: string, x: number, y: number) {
  doc.setFillColor(...COLORS.navy);
  doc.roundedRect(x, y - 4.5, 3, 5.5, 0.8, 0.8, "F");
  doc.setTextColor(...COLORS.ink);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(10.5);
  doc.text(title, x + 5, y);
}

function signedInteger(value: number | null): string {
  if (value === null) return "";
  if (value > 0) return `+${value}`;
  return String(value);
}

function signedPercentage(value: number | null): string {
  if (value === null) return "";
  const formatter = new Intl.NumberFormat("it-IT", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "always",
  });
  return formatter.format(value);
}

function currentTableTotals(rows: CurrentPivotRow[]) {
  return rows.reduce(
    (total, row) => ({
      higherStudents: total.higherStudents + row.higherStudents,
      universityWorker: total.universityWorker + row.universityWorker,
      operator: total.operator + row.operator,
      total: total.total + row.total,
    }),
    { higherStudents: 0, universityWorker: 0, operator: 0, total: 0 },
  );
}

function comparisonTotals(rows: ComparisonRow[]) {
  const previous = rows.reduce((sum, row) => sum + (row.previous ?? 0), 0);
  const current = rows.reduce((sum, row) => sum + (row.current ?? 0), 0);
  const absoluteChange = current - previous;
  return {
    previous,
    current,
    absoluteChange,
    percentageChange: previous === 0 ? null : absoluteChange / previous,
  };
}

function drawCurrentTable(
  doc: jsPDF,
  args: {
    title: string;
    firstColumn: string;
    rows: CurrentPivotRow[];
    x: number;
    y: number;
    width: number;
    compact?: boolean;
    numericColumnWidth?: number;
  },
) {
  drawSectionTitle(doc, args.title, args.x, args.y);
  const totals = currentTableTotals(args.rows);
  const numericWidth = args.numericColumnWidth ?? (args.compact ? 18 : 24);
  const firstWidth = Math.max(args.width - numericWidth * 4, 38);

  autoTable(doc, {
    startY: args.y + 4,
    margin: {
      left: args.x,
      right: doc.internal.pageSize.getWidth() - args.x - args.width,
      bottom: 13,
    },
    tableWidth: args.width,
    pageBreak: "avoid",
    head: [[
      args.firstColumn,
      "Studenti\nsuperiori",
      "Università-\nLavoratore",
      "Operatore",
      "Totale",
    ]],
    body: args.rows.map((row) => [
      row.label,
      row.higherStudents,
      row.universityWorker,
      row.operator,
      row.total,
    ]),
    foot: [[
      "TOTALE",
      totals.higherStudents,
      totals.universityWorker,
      totals.operator,
      totals.total,
    ]],
    styles: {
      font: FONT_FAMILY,
      fontSize: args.compact ? 6.8 : 8,
      cellPadding: args.compact ? 1.05 : 1.5,
      valign: "middle",
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.08,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLORS.navy,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      minCellHeight: args.compact ? 8.5 : 9.5,
    },
    footStyles: {
      fillColor: COLORS.paleBlue,
      textColor: COLORS.navy,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: COLORS.paleSlate },
    columnStyles: {
      0: { cellWidth: firstWidth, halign: "left", fontStyle: "bold" },
      1: { cellWidth: numericWidth, halign: "right" },
      2: { cellWidth: numericWidth, halign: "right" },
      3: { cellWidth: numericWidth, halign: "right" },
      4: { cellWidth: numericWidth, halign: "right", fontStyle: "bold" },
    },
  });
}

function drawComparisonTable(
  doc: jsPDF,
  args: {
    title: string;
    firstColumn: string;
    previousYear: number;
    currentYear: number;
    rows: ComparisonRow[];
    x: number;
    y: number;
    width: number;
    compact?: boolean;
  },
) {
  drawSectionTitle(doc, args.title, args.x, args.y);
  const totals = comparisonTotals(args.rows);
  const numericWidth = args.compact ? 18.5 : 29;
  const firstWidth = Math.max(args.width - numericWidth * 4, 43);

  autoTable(doc, {
    startY: args.y + 4,
    margin: {
      left: args.x,
      right: doc.internal.pageSize.getWidth() - args.x - args.width,
      bottom: 13,
    },
    tableWidth: args.width,
    pageBreak: "avoid",
    head: [[
      args.firstColumn,
      `${args.previousYear}\nGiovani`,
      `${args.currentYear}\nGiovani`,
      "Variazione\nassoluta",
      "Variazione\n%",
    ]],
    body: args.rows.map((row) => [
      row.label,
      row.previous ?? "",
      row.current ?? "",
      signedInteger(row.absoluteChange),
      signedPercentage(row.percentageChange),
    ]),
    foot: [[
      "TOTALE",
      totals.previous,
      totals.current,
      signedInteger(totals.absoluteChange),
      signedPercentage(totals.percentageChange),
    ]],
    styles: {
      font: FONT_FAMILY,
      fontSize: args.compact ? 6.25 : 8,
      cellPadding: args.compact ? 0.55 : 1.5,
      valign: "middle",
      textColor: COLORS.ink,
      lineColor: COLORS.line,
      lineWidth: 0.08,
      overflow: "linebreak",
    },
    headStyles: {
      fillColor: COLORS.teal,
      textColor: [255, 255, 255],
      fontStyle: "bold",
      halign: "center",
      minCellHeight: args.compact ? 7.8 : 9.5,
    },
    footStyles: {
      fillColor: COLORS.paleTeal,
      textColor: COLORS.teal,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: COLORS.paleSlate },
    columnStyles: {
      0: { cellWidth: firstWidth, halign: "left", fontStyle: "bold" },
      1: { cellWidth: numericWidth, halign: "right" },
      2: { cellWidth: numericWidth, halign: "right" },
      3: { cellWidth: numericWidth, halign: "right" },
      4: { cellWidth: numericWidth, halign: "right" },
    },
    didParseCell: (cell) => {
      if (cell.section !== "body" || cell.column.index < 3) return;
      const row = args.rows[cell.row.index];
      if (!row || row.absoluteChange === null) return;
      if (row.absoluteChange > 0) cell.cell.styles.textColor = COLORS.positive;
      if (row.absoluteChange < 0) cell.cell.styles.textColor = COLORS.negative;
      cell.cell.styles.fontStyle = "bold";
    },
  });
}

function drawSummaryCard(
  doc: jsPDF,
  args: {
    x: number;
    y: number;
    width: number;
    label: string;
    value: number;
    accent: [number, number, number];
  },
) {
  doc.setDrawColor(...COLORS.line);
  doc.setFillColor(...COLORS.paleSlate);
  doc.roundedRect(args.x, args.y, args.width, 18, 2, 2, "FD");
  doc.setFillColor(...args.accent);
  doc.roundedRect(args.x, args.y, 3, 18, 2, 2, "F");
  doc.setTextColor(...COLORS.muted);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(6.6);
  doc.text(args.label.toLocaleUpperCase("it"), args.x + 6, args.y + 6);
  doc.setTextColor(...COLORS.ink);
  doc.setFontSize(13.5);
  doc.text(String(args.value), args.x + 6, args.y + 14);
}

function drawOperators(
  doc: jsPDF,
  operators: OperatorRow[],
  currentYear: number,
) {
  addLandscapePage(doc);
  drawPageTitle(
    doc,
    `Lista operatori ${currentYear}`,
    `${operators.length} operatori, ordinati per paese, città e nome. Ogni nominativo compare una sola volta.`,
  );

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;
  const gap = 4;
  const columnCount = 5;
  const columnWidth = (contentWidth - gap * (columnCount - 1)) / columnCount;
  const startY = 31;
  const maxY = 195;
  let columnIndex = 0;
  let y = startY;
  let pageSequence = 1;
  let continuedCountry = "";
  let continuedCity = "";

  const countsByCountry = new Map<string, number>();
  const countsByCity = new Map<string, number>();
  for (const operator of operators) {
    countsByCountry.set(
      operator.country,
      (countsByCountry.get(operator.country) ?? 0) + 1,
    );
    const cityKey = `${operator.country}\u0000${operator.city}`;
    countsByCity.set(cityKey, (countsByCity.get(cityKey) ?? 0) + 1);
  }

  const xForColumn = () => MARGIN_X + columnIndex * (columnWidth + gap);

  const newColumn = () => {
    columnIndex += 1;
    y = startY;
    if (columnIndex >= columnCount) {
      addLandscapePage(doc);
      pageSequence += 1;
      drawPageTitle(
        doc,
        `Lista operatori ${currentYear} - continua`,
        `${operators.length} operatori, ordinati per paese, città e nome.`,
      );
      columnIndex = 0;
    }
  };

  const drawCountry = (country: string, continued = false) => {
    const x = xForColumn();
    doc.setFillColor(...COLORS.navy);
    doc.roundedRect(x, y, columnWidth, 5.3, 1, 1, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(6.8);
    const count = countsByCountry.get(country) ?? 0;
    doc.text(
      `${country.toLocaleUpperCase("it")} · ${count}${continued ? " · segue" : ""}`,
      x + 2,
      y + 3.7,
      { maxWidth: columnWidth - 4 },
    );
    y += 6.5;
  };

  const drawCity = (country: string, city: string, continued = false) => {
    const x = xForColumn();
    doc.setTextColor(...COLORS.teal);
    doc.setFont(FONT_FAMILY, "bold");
    doc.setFontSize(6.6);
    const count = countsByCity.get(`${country}\u0000${city}`) ?? 0;
    doc.text(
      `${city} · ${count}${continued ? " · segue" : ""}`,
      x + 1.5,
      y + 3,
      { maxWidth: columnWidth - 3 },
    );
    doc.setDrawColor(...COLORS.line);
    doc.line(x + 1.5, y + 4, x + columnWidth - 1.5, y + 4);
    y += 5;
  };

  const drawName = (name: string) => {
    const x = xForColumn();
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(6.35);
    doc.setTextColor(...COLORS.ink);
    const lines = doc.splitTextToSize(name, columnWidth - 6) as string[];
    const lineHeight = 2.55;
    doc.setFillColor(...COLORS.blue);
    doc.circle(x + 2.3, y + 1.2, 0.55, "F");
    doc.text(lines, x + 4.2, y + 2.1, { lineHeightFactor: 1.03 });
    y += Math.max(3.05, lines.length * lineHeight + 0.35);
  };

  let index = 0;
  while (index < operators.length) {
    const current = operators[index];
    const newCountry = current.country !== continuedCountry;
    const newCity = newCountry || current.city !== continuedCity;
    const nameLines = doc.splitTextToSize(current.fullName, columnWidth - 6) as string[];
    const requiredHeight =
      (newCountry ? 6.5 : 0) +
      (newCity ? 5 : 0) +
      Math.max(3.05, nameLines.length * 2.55 + 0.35);

    if (y + requiredHeight > maxY) {
      newColumn();
      drawCountry(current.country, !newCountry);
      drawCity(current.country, current.city, !newCity);
      continuedCountry = current.country;
      continuedCity = current.city;
    } else {
      if (newCountry) {
        drawCountry(current.country);
        continuedCountry = current.country;
        continuedCity = "";
      }
      if (newCity) {
        drawCity(current.country, current.city);
        continuedCity = current.city;
      }
    }

    drawName(current.fullName);
    index += 1;
  }

  void pageSequence;
}

function addFooters(doc: jsPDF, currentYear: number) {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(...COLORS.line);
    doc.line(MARGIN_X, 199.5, pageWidth - MARGIN_X, 199.5);
    doc.setFont(FONT_FAMILY, "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(...COLORS.muted);
    doc.text(
      `Global Friendship · Report partecipazione ${currentYear}`,
      MARGIN_X,
      FOOTER_Y,
    );
    doc.text(`Pagina ${page} di ${pageCount}`, pageWidth - MARGIN_X, FOOTER_Y, {
      align: "right",
    });
  }
}

export function buildParticipationReportPdf(args: {
  model: ParticipationReportModel;
  previous: PreviousParticipationSnapshot;
  currentYear: number;
  generatedAt: Date;
  fonts: ParticipationReportFonts;
}): Uint8Array {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: PAGE_FORMAT,
    compress: true,
    putOnlyUsedFonts: true,
    floatPrecision: 4,
  });
  registerFonts(doc, args.fonts);
  doc.setProperties({
    title: `Global Friendship - Report partecipazione ${args.currentYear}`,
    subject: `Partecipazione ${args.currentYear} e confronto con il ${args.previous.year}`,
    author: "Global Friendship",
    creator: "Global Friendship App",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - MARGIN_X * 2;
  doc.setTextColor(...COLORS.navy);
  doc.setFont(FONT_FAMILY, "bold");
  doc.setFontSize(24);
  doc.text(`Partecipazione ${args.currentYear}`, MARGIN_X, 19);
  doc.setFontSize(11);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Quadro corrente, confronto con il ${args.previous.year} e lista operatori`,
    MARGIN_X,
    27,
  );
  const generatedLabel = new Intl.DateTimeFormat("it-IT", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(args.generatedAt);
  doc.setFont(FONT_FAMILY, "normal");
  doc.setFontSize(7.5);
  doc.text(`Generato il ${generatedLabel}`, pageWidth - MARGIN_X, 19, {
    align: "right",
  });

  const cards = [
    {
      label: "Iscritti attivi",
      value: args.model.summary.activeWithoutDrivers,
      accent: COLORS.navy,
    },
    { label: "Giovani", value: args.model.summary.young, accent: COLORS.teal },
    { label: "Studenti superiori", value: args.model.summary.higherStudents, accent: COLORS.blue },
    { label: "Università-Lavoratore", value: args.model.summary.universityWorker, accent: COLORS.blue },
    { label: "Operatori", value: args.model.summary.operators, accent: COLORS.teal },
  ];
  const cardGap = 4;
  const cardWidth = (contentWidth - cardGap * (cards.length - 1)) / cards.length;
  cards.forEach((card, index) => {
    drawSummaryCard(doc, {
      x: MARGIN_X + index * (cardWidth + cardGap),
      y: 34,
      width: cardWidth,
      label: card.label,
      value: card.value,
      accent: card.accent,
    });
  });

  doc.setFillColor(...COLORS.paleBlue);
  doc.roundedRect(MARGIN_X, 56, contentWidth, 12, 1.5, 1.5, "F");
  doc.setFont(FONT_FAMILY, "normal");
  doc.setFontSize(7.7);
  doc.setTextColor(...COLORS.muted);
  doc.text(
    `Le tabelle dell'anno corrente includono studenti superiori, universitari/lavoratori e operatori; i ${args.model.summary.drivers} autisti sono esclusi. Il confronto considera esclusivamente i giovani.`,
    MARGIN_X + 4,
    63.5,
    { maxWidth: contentWidth - 8 },
  );

  const countryTableWidth = 200;
  drawCurrentTable(doc, {
    title: "Registrazioni per paese",
    firstColumn: "Paese",
    rows: args.model.current.countryRows,
    x: (pageWidth - countryTableWidth) / 2,
    y: 75,
    width: countryTableWidth,
    numericColumnWidth: 28,
  });

  addLandscapePage(doc);
  drawPageTitle(
    doc,
    "Partecipazione di quest'anno",
    "Dettaglio delle città italiane e dei gruppi di Roma. Marconi è escluso dai gruppi perché comprende soltanto due operatori senza un gruppo specifico.",
  );
  const halfGap = 7;
  const halfWidth = (contentWidth - halfGap) / 2;
  drawCurrentTable(doc, {
    title: "Città italiane",
    firstColumn: "Città",
    rows: args.model.current.italianCityRows,
    x: MARGIN_X,
    y: 34,
    width: halfWidth,
    compact: true,
  });
  drawCurrentTable(doc, {
    title: "Gruppi di Roma",
    firstColumn: "Gruppo",
    rows: args.model.current.romeGroupRows,
    x: MARGIN_X + halfWidth + halfGap,
    y: 34,
    width: halfWidth,
    compact: true,
  });

  addLandscapePage(doc);
  drawPageTitle(
    doc,
    `Confronto ${args.previous.year}-${args.currentYear}`,
    "Sono sommati studenti superiori, universitari e lavoratori. Operatori, autisti e gli ospiti eccezionali 2025 di Colombia, Guatemala e Honduras sono esclusi. Se una voce compare in un solo anno, l'altro valore e le variazioni restano vuoti.",
  );
  drawComparisonTable(doc, {
    title: "Giovani per paese",
    firstColumn: "Paese",
    previousYear: args.previous.year,
    currentYear: args.currentYear,
    rows: args.model.comparison.countryRows,
    x: MARGIN_X,
    y: 36,
    width: halfWidth,
    compact: true,
  });
  drawComparisonTable(doc, {
    title: "Giovani nelle città italiane",
    firstColumn: "Città",
    previousYear: args.previous.year,
    currentYear: args.currentYear,
    rows: args.model.comparison.italianCityRows,
    x: MARGIN_X + halfWidth + halfGap,
    y: 36,
    width: halfWidth,
    compact: true,
  });

  drawOperators(doc, args.model.operators, args.currentYear);
  addFooters(doc, args.currentYear);
  return new Uint8Array(doc.output("arraybuffer"));
}
