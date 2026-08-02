import * as XLSX from "xlsx";
import { describeAccessibility } from "./accessibility.ts";
import { displayPersonalCode } from "./staff-availability-export.ts";

export type AccessibilityExportRow = {
  id: string;
  personal_code: string | null;
  email: string | null;
  telefono: string | null;
  nome: string | null;
  cognome: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  deleted_at: string | null;
  disabilita_accessibilita: boolean | null;
  difficolta_accessibilita: string | null;
};

export function buildAccessibilityWorkbook(
  rows: AccessibilityExportRow[],
): Buffer {
  const matrix = [
    [
      "ID",
      "Email",
      "Telefono",
      "Nome",
      "Cognome",
      "Gruppo",
      "Disabilità / Accessibilità",
    ],
    ...rows.map((row) => [
      displayPersonalCode(row.personal_code),
      row.email ?? "",
      row.telefono ?? "",
      row.nome ?? "",
      row.cognome ?? "",
      row.gruppo_label ?? row.gruppo_id ?? "",
      describeAccessibility(row),
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!autofilter"] = { ref: `A1:G${Math.max(1, matrix.length)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 36 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 30 },
    { wch: 70 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Accessibilità");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
