import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  parseBankStatementRows,
  type BankStatementCell,
  type ParsedBankPayment,
} from "@/lib/participation-fees/bank-statement";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

type ParticipantRow = {
  id: string;
  personal_code: string;
  nome: string | null;
  cognome: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  deleted_at: string | null;
};

type RpcResult = {
  source_key: string;
  imported: boolean;
  fee_paid: number | null;
};

type ReportStatus = "imported" | "duplicate" | "unmatched";

type ReportRow = ParsedBankPayment & {
  status: ReportStatus;
  participantName: string;
  group: string;
  note: string;
};

async function requireManager() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  const service = createSupabaseServiceClient();
  const { data: profile, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .eq("ruolo", "manager")
    .limit(1);

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }
  if (!profile || profile.length === 0) {
    return { errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user, service };
}

function paymentSourceKey(payment: ParsedBankPayment): string {
  const identity = payment.bankReference
    ? `bank-reference:${payment.bankReference}`
    : [
        payment.paymentDate ?? "",
        payment.amount?.toFixed(2) ?? "",
        payment.description.replace(/\s+/g, " ").trim().toLowerCase(),
      ].join("|");
  return createHash("sha256").update(identity).digest("hex");
}

function noteForUnmatched(payment: ParsedBankPayment): string {
  if (payment.matchStatus === "invalid_row") {
    return "Data o importo dell'accredito non validi.";
  }
  if (payment.matchStatus === "unknown_code") {
    return `Il codice ${payment.personalCode ?? "indicato"} non corrisponde a un partecipante attivo.`;
  }
  if (payment.matchStatus === "ambiguous_code") {
    return `Più codici riconoscibili nella causale: ${payment.candidateCodes.join(", ")}.`;
  }
  return "Nessun codice partecipante riconoscibile nella causale.";
}

function buildReportWorkbook(fileName: string, rows: ReportRow[]) {
  const imported = rows.filter((row) => row.status === "imported").length;
  const duplicate = rows.filter((row) => row.status === "duplicate").length;
  const unmatched = rows.filter((row) => row.status === "unmatched").length;
  const header = [
    "Esito",
    "Data bonifico",
    "Importo",
    "ID rilevato",
    "Partecipante",
    "Gruppo",
    "Riferimento banca",
    "Riga file",
    "Nota",
    "Causale",
  ];

  const statusLabel: Record<ReportStatus, string> = {
    imported: "IMPORTATO",
    duplicate: "GIÀ IMPORTATO",
    unmatched: "DA VERIFICARE",
  };
  const dataRows = rows.map((row) => [
    statusLabel[row.status],
    row.paymentDate ?? "",
    row.amount ?? "",
    row.personalCode ?? row.candidateCodes.join(", "),
    row.participantName,
    row.group,
    row.bankReference ?? "",
    row.sourceRow,
    row.note,
    row.description,
  ]);

  const summary = [
    ["REPORT IMPORTAZIONE QUOTE DA ESTRATTO CONTO"],
    ["File sorgente", fileName],
    ["Movimenti Global/Budapest", rows.length],
    ["Quote importate", imported],
    ["Già importate", duplicate],
    ["Da verificare manualmente", unmatched],
    [],
    header,
    ...dataRows,
  ];

  const workbook = XLSX.utils.book_new();
  const reportSheet = XLSX.utils.aoa_to_sheet(summary);
  reportSheet["!cols"] = [
    { wch: 18 },
    { wch: 15 },
    { wch: 12 },
    { wch: 14 },
    { wch: 28 },
    { wch: 24 },
    { wch: 22 },
    { wch: 10 },
    { wch: 42 },
    { wch: 90 },
  ];
  reportSheet["!autofilter"] = { ref: `A8:J${Math.max(8, rows.length + 8)}` };
  for (let rowIndex = 8; rowIndex < rows.length + 8; rowIndex += 1) {
    const amountCell = reportSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 2 })];
    if (amountCell) amountCell.z = '€ #,##0.00';
  }
  XLSX.utils.book_append_sheet(workbook, reportSheet, "Report completo");

  const reviewRows = rows.filter((row) => row.status === "unmatched");
  const reviewSheet = XLSX.utils.aoa_to_sheet([
    header,
    ...reviewRows.map((row) => [
      statusLabel[row.status],
      row.paymentDate ?? "",
      row.amount ?? "",
      row.personalCode ?? row.candidateCodes.join(", "),
      row.participantName,
      row.group,
      row.bankReference ?? "",
      row.sourceRow,
      row.note,
      row.description,
    ]),
  ]);
  reviewSheet["!cols"] = reportSheet["!cols"];
  reviewSheet["!autofilter"] = { ref: `A1:J${Math.max(1, reviewRows.length + 1)}` };
  for (let rowIndex = 1; rowIndex < reviewRows.length + 1; rowIndex += 1) {
    const amountCell = reviewSheet[XLSX.utils.encode_cell({ r: rowIndex, c: 2 })];
    if (amountCell) amountCell.z = '€ #,##0.00';
  }
  XLSX.utils.book_append_sheet(workbook, reviewSheet, "Da verificare");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx", compression: true });
}

function safeBaseName(fileName: string): string {
  const withoutExtension = fileName.replace(/\.[^.]+$/, "");
  const normalized = withoutExtension.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return normalized.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "estratto-conto";
}

export async function POST(request: Request) {
  const auth = await requireManager();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Seleziona un file Excel." }, { status: 400 });
    }
    if (!/\.xlsx?$/i.test(file.name)) {
      return NextResponse.json({ error: "Sono accettati solo file .xlsx o .xls." }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: "Il file è vuoto o supera il limite di 10 MB." },
        { status: 400 }
      );
    }

    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json({ error: "Il file Excel non contiene fogli." }, { status: 400 });
    }
    const rows = XLSX.utils.sheet_to_json<BankStatementCell[]>(workbook.Sheets[firstSheetName], {
      header: 1,
      raw: true,
      defval: null,
    });

    const { data: participantData, error: participantsError } = await auth.service
      .from("partecipanti")
      .select("id,personal_code,nome,cognome,gruppo_label,gruppo_id,deleted_at")
      .is("deleted_at", null);
    if (participantsError) throw new Error(participantsError.message);

    const participants = (participantData ?? []) as ParticipantRow[];
    const byCode = new Map(participants.map((participant) => [participant.personal_code, participant]));
    const parsedPayments = parseBankStatementRows(rows, new Set(byCode.keys()));

    const importable = parsedPayments.filter(
      (payment) =>
        payment.matchStatus === "matched" &&
        payment.personalCode &&
        payment.paymentDate &&
        payment.amount
    );
    const rpcPayload = importable.map((payment) => ({
      participant_id: byCode.get(payment.personalCode as string)?.id,
      payment_date: payment.paymentDate,
      amount: payment.amount,
      bank_reference: payment.bankReference,
      source_key: paymentSourceKey(payment),
      source_filename: file.name,
      source_row: payment.sourceRow,
      description: payment.description,
    }));

    let rpcRows: RpcResult[] = [];
    if (rpcPayload.length > 0) {
      const { data, error } = await auth.service.rpc(
        "manager_import_participation_fee_bank_payments",
        { payments: rpcPayload, actor_id: auth.user.id }
      );
      if (error) throw new Error(error.message);
      rpcRows = (data ?? []) as RpcResult[];
    }

    const rpcQueues = new Map<string, RpcResult[]>();
    for (const row of rpcRows) {
      const queue = rpcQueues.get(row.source_key) ?? [];
      queue.push(row);
      rpcQueues.set(row.source_key, queue);
    }

    const reportRows: ReportRow[] = parsedPayments.map((payment) => {
      const participant = payment.personalCode ? byCode.get(payment.personalCode) : undefined;
      if (payment.matchStatus !== "matched" || !participant) {
        return {
          ...payment,
          status: "unmatched",
          participantName: "",
          group: "",
          note: noteForUnmatched(payment),
        };
      }

      const sourceKey = paymentSourceKey(payment);
      const result = rpcQueues.get(sourceKey)?.shift();
      const participantName = [participant.nome, participant.cognome].filter(Boolean).join(" ");
      return {
        ...payment,
        status: result?.imported ? "imported" : "duplicate",
        participantName,
        group: participant.gruppo_label ?? participant.gruppo_id ?? "",
        note: result?.imported
          ? "Quota sommata al totale pagato del partecipante."
          : "Stesso partecipante, data e importo già importati, oppure stesso riferimento bancario.",
      };
    });

    const importedCount = reportRows.filter((row) => row.status === "imported").length;
    const duplicateCount = reportRows.filter((row) => row.status === "duplicate").length;
    const unmatchedCount = reportRows.filter((row) => row.status === "unmatched").length;
    const report = buildReportWorkbook(file.name, reportRows);
    const reportName = `report-importazione-quote-${safeBaseName(file.name)}.xlsx`;

    return new Response(report, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${reportName}"`,
        "X-Import-Matched": String(parsedPayments.length),
        "X-Import-Imported": String(importedCount),
        "X-Import-Duplicates": String(duplicateCount),
        "X-Import-Unmatched": String(unmatchedCount),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Importazione non riuscita.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
