import * as XLSX from "xlsx";
import {
  describeStaffAvailability,
  type StaffAvailabilityStatRow,
} from "./staff-availability.ts";

export type StaffAvailabilityExportParticipant = {
  id: string;
  personal_code: string | null;
  email: string | null;
  telefono: string | null;
  nome: string | null;
  cognome: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  deleted_at: string | null;
};

export type StaffAvailabilityExportRow = StaffAvailabilityExportParticipant & {
  availability: StaffAvailabilityStatRow;
};

export function displayPersonalCode(value: string | null): string {
  const normalized = (value ?? "").trim();
  return /^\d{1,4}$/.test(normalized) ? normalized.padStart(4, "0") : normalized;
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("it-IT", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Europe/Rome",
  }).format(date);
}

export function buildStaffAvailabilityWorkbook(
  rows: StaffAvailabilityExportRow[],
): Buffer {
  const matrix = [
    [
      "ID",
      "Email",
      "Telefono",
      "Nome",
      "Cognome",
      "Gruppo",
      "Disponibilità",
      "Ultimo aggiornamento",
    ],
    ...rows.map((row) => [
      displayPersonalCode(row.personal_code),
      row.email ?? "",
      row.telefono ?? "",
      row.nome ?? "",
      row.cognome ?? "",
      row.gruppo_label ?? row.gruppo_id ?? "",
      describeStaffAvailability(row.availability),
      formatDateTime(row.availability.updated_at),
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!autofilter"] = { ref: `A1:H${Math.max(1, matrix.length)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 36 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 30 },
    { wch: 70 },
    { wch: 22 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Disponibilità staff");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
