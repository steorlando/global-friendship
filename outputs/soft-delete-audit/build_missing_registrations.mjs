import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const csvPath = "/Users/stefanolaptop/Downloads/Registration form Global 2026_Submissions_2026-05-30.csv";
const dbCsvPath = "/tmp/gf_participants_export.csv";
const outputDir = "/Users/stefanolaptop/Documents/codex_new/global-friendship/outputs/soft-delete-audit";
const outputPath = path.join(outputDir, "registrazioni_non_trovate_supabase.xlsx");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  if (text.charCodeAt(0) === 0xfeff) {
    text = text.slice(1);
  }

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === "\"" && next === "\"") {
        field += "\"";
        i += 1;
      } else if (char === "\"") {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === "\"") {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function rowsToObjects(rows) {
  const headers = rows[0] ?? [];
  return rows.slice(1).filter((row) => row.some((value) => String(value ?? "").trim())).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      object[header] = row[index] ?? "";
    });
    return object;
  });
}

function norm(value) {
  return String(value ?? "").trim().toLowerCase();
}

function compact(value) {
  return String(value ?? "").trim();
}

function firstEmail(row) {
  return norm(row["e-mail"] || row.email);
}

const tallyRows = rowsToObjects(parseCsv(await fs.readFile(csvPath, "utf8")));
const dbRows = rowsToObjects(parseCsv(await fs.readFile(dbCsvPath, "utf8")));

const dbSubmissionIds = new Set(dbRows.map((row) => compact(row.tally_submission_id)).filter(Boolean));
const dbEmails = new Set(dbRows.map((row) => norm(row.email)).filter(Boolean));

const missingRows = tallyRows
  .map((row) => {
    const submissionId = compact(row["Submission ID"]);
    const email = firstEmail(row);
    const foundBySubmissionId = submissionId ? dbSubmissionIds.has(submissionId) : false;
    const foundByEmail = email ? dbEmails.has(email) : false;

    return {
      submissionId,
      submittedAt: compact(row["Submitted at"]),
      firstName: compact(row["Name/Nome/Nombre/Prenom"]),
      lastName: compact(row["Surname / Cognome / Apellido / Nom de famille"]),
      email,
      secondaryEmail: norm(row["e-mail-2"]),
      registrationType: compact(row["Type of registration / Tipo di iscrizione / Tipo de registro / Type d'inscription"]),
      country: compact(row["Country of residence / Paese di residenza / País de residencia / Pays de résidence"]),
      city: compact(row.City),
      groupLeader: compact(row["Who is your group leader?"]),
      arrival: compact(row["Date of arrival and departure"]),
      departure: compact(row.Departure),
      accommodation: compact(row["Where are you staying? Dove alloggerai?"]),
      foundBySubmissionId,
      foundByEmail,
      missingReason: foundBySubmissionId
        ? ""
        : foundByEmail
          ? "Submission ID non trovato, ma email presente nel DB"
          : "Submission ID ed email non trovati nel DB",
    };
  })
  .filter((row) => !row.foundBySubmissionId);

const stronglyMissingRows = missingRows.filter((row) => !row.foundByEmail);
const suspiciousRows = missingRows.filter((row) => row.foundByEmail);
const kramekoszRows = missingRows.filter((row) => row.email === "kramekosz@gmail.com" || row.secondaryEmail === "kramekosz@gmail.com");
const dbKramekoszRows = dbRows.filter((row) => norm(row.email) === "kramekosz@gmail.com");

const workbook = Workbook.create();
const summary = workbook.worksheets.add("Sintesi");
const missing = workbook.worksheets.add("Mancanti forti");
const suspicious = workbook.worksheets.add("Solo submission mancante");
const dbSheet = workbook.worksheets.add("DB Supabase");

summary.getRange("A1:D1").values = [["Audit registrazioni Tally vs Supabase", "", "", ""]];
summary.getRange("A1:D1").merge();
summary.getRange("A3:B10").values = [
  ["CSV analizzato", path.basename(csvPath)],
  ["Righe registrazioni nel CSV", tallyRows.length],
  ["Record partecipanti in Supabase", dbRows.length],
  ["Submission ID CSV non trovati in Supabase", missingRows.length],
  ["Mancanti forti (submission + email assenti)", stronglyMissingRows.length],
  ["Email presente ma submission assente", suspiciousRows.length],
  ["Righe mancanti per kramekosz@gmail.com", kramekoszRows.length],
  ["Record DB con kramekosz@gmail.com", dbKramekoszRows.length],
];
summary.getRange("A12:D14").values = [
  ["Interpretazione", "", "", ""],
  ["Mancanti forti", "Probabili record cancellati o mai importati: non esistono né Submission ID né email nel DB.", "", ""],
  ["Solo submission mancante", "Da verificare: l'email esiste già in Supabase, ma non con quella Submission ID.", "", ""],
];

const outputHeaders = [
  "Submission ID",
  "Submitted at",
  "Nome",
  "Cognome",
  "Email",
  "Email 2",
  "Tipo iscrizione",
  "Paese",
  "Città",
  "Capogruppo",
  "Arrivo",
  "Partenza",
  "Alloggio",
  "Motivo",
];

function writeRows(sheet, rows) {
  sheet.getRangeByIndexes(0, 0, 1, outputHeaders.length).values = [outputHeaders];
  const values = rows.map((row) => [
    row.submissionId,
    row.submittedAt,
    row.firstName,
    row.lastName,
    row.email,
    row.secondaryEmail,
    row.registrationType,
    row.country,
    row.city,
    row.groupLeader,
    row.arrival,
    row.departure,
    row.accommodation,
    row.missingReason,
  ]);
  if (values.length > 0) {
    sheet.getRangeByIndexes(1, 0, values.length, outputHeaders.length).values = values;
  }
  const tableRange = `A1:N${Math.max(values.length + 1, 2)}`;
  sheet.tables.add(tableRange, true, `${sheet.name.replaceAll(" ", "")}Table`);
  sheet.freezePanes.freezeRows(1);
  sheet.getRange("A:N").format.wrapText = true;
  sheet.getRange("A:N").format.autofitColumns();
}

writeRows(missing, stronglyMissingRows);
writeRows(suspicious, suspiciousRows);

const dbHeaders = ["id", "tally_submission_id", "email", "nome", "cognome", "submitted_at_tally", "created_at"];
dbSheet.getRangeByIndexes(0, 0, 1, dbHeaders.length).values = [dbHeaders];
if (dbRows.length > 0) {
  dbSheet.getRangeByIndexes(1, 0, dbRows.length, dbHeaders.length).values = dbRows.map((row) =>
    dbHeaders.map((header) => row[header] ?? "")
  );
}
dbSheet.tables.add(`A1:G${Math.max(dbRows.length + 1, 2)}`, true, "SupabaseTable");
dbSheet.freezePanes.freezeRows(1);
dbSheet.getRange("A:G").format.autofitColumns();

for (const sheet of [summary, missing, suspicious, dbSheet]) {
  sheet.showGridLines = false;
  sheet.getRange("A1:Z1").format = {
    fill: "#164E63",
    font: { bold: true, color: "#FFFFFF" },
  };
}
summary.getRange("A1:D1").format = {
  fill: "#164E63",
  font: { bold: true, color: "#FFFFFF", size: 15 },
};
summary.getRange("A3:A10").format = {
  fill: "#E0F2FE",
  font: { bold: true, color: "#0F172A" },
};
summary.getRange("A12:D12").format = {
  fill: "#FEF3C7",
  font: { bold: true, color: "#92400E" },
};
summary.getRange("A:D").format.autofitColumns();
summary.getRange("B13:B14").format.wrapText = true;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "Sintesi", autoCrop: "all", scale: 1, format: "png" });
await fs.writeFile(path.join(outputDir, "preview_sintesi.png"), new Uint8Array(await preview.arrayBuffer()));
const errors = await workbook.inspect({
  kind: "match",
  searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options: { useRegex: true, maxResults: 100 },
  summary: "formula errors",
});
await fs.writeFile(path.join(outputDir, "audit_summary.json"), JSON.stringify({
  csvRows: tallyRows.length,
  dbRows: dbRows.length,
  missingSubmissionRows: missingRows.length,
  stronglyMissingRows: stronglyMissingRows.length,
  suspiciousRows: suspiciousRows.length,
  kramekoszMissingRows: kramekoszRows,
  dbKramekoszRows,
  errorScan: errors.ndjson,
}, null, 2));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({
  outputPath,
  csvRows: tallyRows.length,
  dbRows: dbRows.length,
  missingSubmissionRows: missingRows.length,
  stronglyMissingRows: stronglyMissingRows.length,
  suspiciousRows: suspiciousRows.length,
  kramekoszMissingCount: kramekoszRows.length,
  dbKramekoszCount: dbKramekoszRows.length,
}, null, 2));
