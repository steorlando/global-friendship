export type BankStatementCell = string | number | boolean | Date | null | undefined;

export type BankPaymentMatchStatus =
  | "matched"
  | "missing_code"
  | "unknown_code"
  | "ambiguous_code"
  | "invalid_row";

export type ParsedBankPayment = {
  sourceRow: number;
  paymentDate: string | null;
  amount: number | null;
  description: string;
  bankReference: string | null;
  personalCode: string | null;
  candidateCodes: string[];
  matchStatus: BankPaymentMatchStatus;
};

type StatementColumns = {
  date: number;
  credit: number;
  description: number;
};

const KEYWORD_PATTERN = /\b(?:global|budapest)\b/i;
const EXPLICIT_ID_PATTERN = /\bID\s*[:#-]?\s*0*(\d{1,4})\b/i;
const BANK_REFERENCE_PATTERN = /\bCOD\.?\s*DISP\.?\s*:\s*([A-Z0-9]{10,})\b/i;

function normalizeHeader(value: BankStatementCell): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function normalizePersonalCode(value: string): string {
  return String(Number.parseInt(value, 10)).padStart(4, "0");
}

function findColumns(rows: BankStatementCell[][]): { headerIndex: number; columns: StatementColumns } {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const normalized = rows[rowIndex].map(normalizeHeader);
    const date = normalized.findIndex((value) => value === "data contabile" || value === "data");
    const credit = normalized.findIndex((value) => value === "accrediti" || value === "accredito");
    const description = normalized.findIndex(
      (value) => value === "descrizione estesa" || value === "causale"
    );

    if (date >= 0 && credit >= 0 && description >= 0) {
      return { headerIndex: rowIndex, columns: { date, credit, description } };
    }
  }

  throw new Error(
    "Intestazioni non riconosciute: servono Data contabile, Accrediti e Descrizione estesa/Causale."
  );
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function parseBankDate(value: BankStatementCell): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const wholeDays = Math.floor(value);
    const date = new Date(Date.UTC(1899, 11, 30) + wholeDays * 86_400_000);
    return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  const italian = text.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (italian) {
    return `${italian[3]}-${pad(Number(italian[2]))}-${pad(Number(italian[1]))}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function parseCreditAmount(value: BankStatementCell): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? Number(value.toFixed(2)) : null;
  }

  const raw = String(value ?? "").trim().replace(/\s/g, "");
  if (!raw || raw === "-") return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? Number(parsed.toFixed(2)) : null;
}

function narrativeAfterKeyword(description: string): string {
  const keywordIndex = description.search(KEYWORD_PATTERN);
  if (keywordIndex < 0) return description;
  const afterKeyword = description.slice(keywordIndex);
  const bankSuffixIndex = afterKeyword.search(/\bBonifico a Vostro favore\b/i);
  return bankSuffixIndex >= 0 ? afterKeyword.slice(0, bankSuffixIndex) : afterKeyword;
}

export function matchPersonalCode(
  description: string,
  knownPersonalCodes: ReadonlySet<string>
): Pick<ParsedBankPayment, "personalCode" | "candidateCodes" | "matchStatus"> {
  const explicit = description.match(EXPLICIT_ID_PATTERN);
  if (explicit) {
    const code = normalizePersonalCode(explicit[1]);
    return knownPersonalCodes.has(code)
      ? { personalCode: code, candidateCodes: [code], matchStatus: "matched" }
      : { personalCode: code, candidateCodes: [code], matchStatus: "unknown_code" };
  }

  const candidates = new Set<string>();
  const narrative = narrativeAfterKeyword(description);
  for (const match of narrative.matchAll(/(?<!\d)(\d{4})(?!\d)/g)) {
    const numeric = Number.parseInt(match[1], 10);
    if (numeric >= 1900 && numeric <= 2099) continue;
    const code = normalizePersonalCode(match[1]);
    if (knownPersonalCodes.has(code)) candidates.add(code);
  }

  const candidateCodes = [...candidates];
  if (candidateCodes.length === 1) {
    return { personalCode: candidateCodes[0], candidateCodes, matchStatus: "matched" };
  }
  if (candidateCodes.length > 1) {
    return { personalCode: null, candidateCodes, matchStatus: "ambiguous_code" };
  }
  return { personalCode: null, candidateCodes: [], matchStatus: "missing_code" };
}

export function parseBankStatementRows(
  rows: BankStatementCell[][],
  knownPersonalCodes: ReadonlySet<string>
): ParsedBankPayment[] {
  const { headerIndex, columns } = findColumns(rows);
  const payments: ParsedBankPayment[] = [];

  for (let rowIndex = headerIndex + 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const description = String(row[columns.description] ?? "").trim();
    if (!KEYWORD_PATTERN.test(description)) continue;

    const paymentDate = parseBankDate(row[columns.date]);
    const amount = parseCreditAmount(row[columns.credit]);
    const codeMatch = matchPersonalCode(description, knownPersonalCodes);
    const bankReference = description.match(BANK_REFERENCE_PATTERN)?.[1] ?? null;

    payments.push({
      sourceRow: rowIndex + 1,
      paymentDate,
      amount,
      description,
      bankReference,
      ...codeMatch,
      matchStatus: paymentDate && amount ? codeMatch.matchStatus : "invalid_row",
    });
  }

  return payments;
}
