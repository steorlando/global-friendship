import * as XLSX from "xlsx";
import {
  detectedFoodTextCategories,
  describeDietaryRequirements,
  dietaryOtherDetails,
  hasMeaningfulAllergyText,
} from "./food-needs.ts";
import { displayPersonalCode } from "./staff-availability-export.ts";

export type FoodNeedsExportRow = {
  id: string;
  personal_code: string | null;
  email: string | null;
  telefono: string | null;
  nome: string | null;
  cognome: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  deleted_at: string | null;
  esigenze_alimentari: string | null;
  allergie: string | null;
  assigned_hostel_name: string | null;
};

export function buildFoodNeedsWorkbook(rows: FoodNeedsExportRow[]): Buffer {
  const matrix = [
    [
      "ID",
      "Email",
      "Telefono",
      "Nome",
      "Cognome",
      "Gruppo",
      "Ostello assegnato",
      "Esigenze alimentari",
      "Altro / Dettaglio",
      "Allergie / Intolleranze",
      "Categorie rilevate nel testo",
    ],
    ...rows.map((row) => [
      displayPersonalCode(row.personal_code),
      row.email ?? "",
      row.telefono ?? "",
      row.nome ?? "",
      row.cognome ?? "",
      row.gruppo_label ?? row.gruppo_id ?? "",
      row.assigned_hostel_name ?? "",
      describeDietaryRequirements(row),
      dietaryOtherDetails(row.esigenze_alimentari),
      hasMeaningfulAllergyText(row.allergie) ? row.allergie?.trim() ?? "" : "",
      detectedFoodTextCategories(row)
        .map((category) => {
          if (category === "gluten_celiac") return "Celiachia / senza glutine";
          if (category === "lactose_dairy") return "Lattosio / latticini";
          if (category === "nuts_peanuts") return "Frutta a guscio / arachidi";
          return "Pesce / crostacei / molluschi";
        })
        .join("; "),
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!autofilter"] = { ref: `A1:K${Math.max(1, matrix.length)}` };
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };
  worksheet["!cols"] = [
    { wch: 10 },
    { wch: 36 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 30 },
    { wch: 30 },
    { wch: 44 },
    { wch: 56 },
    { wch: 60 },
    { wch: 54 },
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, "Esigenze alimentari");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}
