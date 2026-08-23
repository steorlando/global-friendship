#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import XLSX from "xlsx";
import {
  buildParticipationReportModel,
  buildParticipationReportPdf,
  buildPreviousParticipationSnapshotFromRows,
  type ParticipationParticipant,
  type PreviousParticipationSnapshot,
  type PreviousWorkbookRow,
} from "../lib/statistics/participation-report.ts";

type ParsedArgs = {
  flags: Map<string, string>;
  booleans: Set<string>;
};

function printUsage() {
  console.log(`
Genera il report PDF sulla partecipazione Global Friendship.

Uso:
  npm run report:partecipazione -- [opzioni]

Opzioni:
  --output <file.pdf>                 Destinazione del PDF
  --current-year <anno>              Anno corrente (default: 2026)
  --previous-snapshot <file.json>    Dati aggregati dell'anno precedente
  --previous-year-xlsx <file.xlsx>   Ricostruisce il confronto dal file Excel
  --previous-year <anno>             Anno del file Excel (default: 2025)
  --generated-at <ISO-8601>          Data/ora da stampare nel report
  --expected-operators <numero>      Controllo opzionale sul numero operatori
  --help                             Mostra questa guida

Il comando è di sola lettura sul database. Carica .env.local e .env, poi usa
SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.
`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const flags = new Map<string, string>();
  const booleans = new Set<string>();
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new Error(`Argomento non riconosciuto: ${token}`);
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      booleans.add(key);
      continue;
    }
    flags.set(key, next);
    index += 1;
  }
  return { flags, booleans };
}

function positiveInteger(raw: string | undefined, fallback: number, label: string): number {
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} deve essere un intero positivo.`);
  }
  return value;
}

function loadEnvFile(fileName: string) {
  const filePath = path.resolve(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

function loadPreviousSnapshot(args: {
  snapshotPath: string;
  workbookPath?: string;
  previousYear: number;
}): PreviousParticipationSnapshot {
  if (!args.workbookPath) {
    return JSON.parse(fs.readFileSync(args.snapshotPath, "utf8")) as PreviousParticipationSnapshot;
  }

  const workbook = XLSX.readFile(args.workbookPath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("Il file Excel non contiene fogli.");
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<PreviousWorkbookRow>(sheet, {
    defval: null,
    raw: false,
  });
  return buildPreviousParticipationSnapshotFromRows({
    rows,
    year: args.previousYear,
    sourceFile: path.basename(args.workbookPath),
    sheetName,
  });
}

async function loadCurrentParticipants(): Promise<ParticipationParticipant[]> {
  loadEnvFile(".env.local");
  loadEnvFile(".env");
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      "Variabili Supabase mancanti: servono SUPABASE_URL (o NEXT_PUBLIC_SUPABASE_URL) e SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const pageSize = 1000;
  const participants: ParticipationParticipant[] = [];

  for (let start = 0; ; start += pageSize) {
    let page: ParticipationParticipant[] | null = null;
    let lastError = "errore sconosciuto";
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const { data, error } = await supabase
        .from("partecipanti")
        .select(
          "id,nome,cognome,tipo_iscrizione,paese_residenza,nazione,citta:città,gruppo_label,gruppo_id",
        )
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .range(start, start + pageSize - 1);
      if (!error) {
        page = (data ?? []) as unknown as ParticipationParticipant[];
        break;
      }
      lastError = error.message;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 500));
      }
    }
    if (!page) throw new Error(`Lettura partecipanti fallita: ${lastError}`);

    participants.push(...page);
    if (page.length < pageSize) break;
  }

  return participants;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.booleans.has("help")) {
    printUsage();
    return;
  }

  const currentYear = positiveInteger(
    args.flags.get("current-year"),
    2026,
    "--current-year",
  );
  const previousYear = positiveInteger(
    args.flags.get("previous-year"),
    2025,
    "--previous-year",
  );
  const snapshotPath = path.resolve(
    args.flags.get("previous-snapshot") ?? "data/participation-report-2025.json",
  );
  const workbookPath = args.flags.get("previous-year-xlsx")
    ? path.resolve(args.flags.get("previous-year-xlsx") as string)
    : undefined;
  const outputPath = path.resolve(
    args.flags.get("output") ?? `output/pdf/report-partecipazione-${currentYear}.pdf`,
  );
  const generatedAtRaw = args.flags.get("generated-at");
  const generatedAt = generatedAtRaw ? new Date(generatedAtRaw) : new Date();
  if (Number.isNaN(generatedAt.getTime())) {
    throw new Error("--generated-at non è una data ISO-8601 valida.");
  }

  const previous = loadPreviousSnapshot({
    snapshotPath,
    workbookPath,
    previousYear,
  });
  const participants = await loadCurrentParticipants();
  const model = buildParticipationReportModel({ participants, previous });
  const expectedOperatorsRaw = args.flags.get("expected-operators");
  if (expectedOperatorsRaw !== undefined) {
    const expectedOperators = positiveInteger(
      expectedOperatorsRaw,
      0,
      "--expected-operators",
    );
    if (model.summary.operators !== expectedOperators) {
      throw new Error(
        `Controllo operatori fallito: attesi ${expectedOperators}, trovati ${model.summary.operators}.`,
      );
    }
  }

  const fontDirectory = path.resolve("node_modules/dejavu-fonts-ttf/ttf");
  const pdf = buildParticipationReportPdf({
    model,
    previous,
    currentYear,
    generatedAt,
    fonts: {
      regular: fs.readFileSync(path.join(fontDirectory, "DejaVuSansCondensed.ttf")),
      bold: fs.readFileSync(path.join(fontDirectory, "DejaVuSansCondensed-Bold.ttf")),
    },
  });

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, pdf);
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        bytes: pdf.byteLength,
        currentYear,
        previousYear: previous.year,
        databaseActiveParticipants: model.summary.active,
        activeParticipantsExcludingDrivers: model.summary.activeWithoutDrivers,
        reportedParticipants: model.summary.reported,
        youngParticipants: model.summary.young,
        operators: model.summary.operators,
        driversExcluded: model.summary.drivers,
        countryRows: model.current.countryRows.length,
        italianCityRows: model.current.italianCityRows.length,
        romeGroupRows: model.current.romeGroupRows.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
