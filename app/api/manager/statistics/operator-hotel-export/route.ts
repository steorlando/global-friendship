import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  isAutonomousAccommodation,
  isOperatorRegistrationType,
  normalizeOperatorAccommodationPreference,
} from "@/lib/partecipante/constants";

export const runtime = "nodejs";

type OperatorHotelRow = {
  nome: string | null;
  cognome: string | null;
  email: string | null;
  telefono: string | null;
  gruppo_label: string | null;
  gruppo_id: string | null;
  data_arrivo: string | null;
  data_partenza: string | null;
  tipo_iscrizione: string | null;
  preferenza_alloggio_operatore: string | null;
  alloggio_short: string | null;
  alloggio: string | null;
};

async function requireManagerOrAdmin() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const email = (user.email ?? "").trim().toLowerCase();
  if (!email) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  const service = createSupabaseServiceClient();
  const { data: profiles, error: profileError } = await service
    .from("profili")
    .select("ruolo")
    .ilike("email", email)
    .in("ruolo", ["manager", "admin"])
    .limit(1);

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }
  if (!profiles || profiles.length === 0) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { service };
}

function formatDate(value: string | null): string {
  const match = (value ?? "").trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function buildWorkbook(rows: OperatorHotelRow[]): Buffer {
  const header = [
    "Nome",
    "Cognome",
    "Email",
    "Numero di telefono",
    "Gruppo di appartenenza",
    "Data di arrivo",
    "Data di partenza",
  ];
  const matrix = [
    header,
    ...rows.map((row) => [
      row.nome ?? "",
      row.cognome ?? "",
      row.email ?? "",
      row.telefono ?? "",
      row.gruppo_label ?? row.gruppo_id ?? "",
      formatDate(row.data_arrivo),
      formatDate(row.data_partenza),
    ]),
  ];

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet["!autofilter"] = { ref: `A1:G${Math.max(1, matrix.length)}` };
  worksheet["!cols"] = [
    { wch: 20 },
    { wch: 24 },
    { wch: 38 },
    { wch: 22 },
    { wch: 30 },
    { wch: 18 },
    { wch: 18 },
  ];
  worksheet["!freeze"] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(workbook, worksheet, "Operatori Hotel");
  return XLSX.write(workbook, {
    type: "buffer",
    bookType: "xlsx",
    compression: true,
  });
}

export async function GET() {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { data, error } = await auth.service
    .from("partecipanti")
    .select(
      "nome,cognome,email,telefono,gruppo_label,gruppo_id,data_arrivo,data_partenza,tipo_iscrizione,preferenza_alloggio_operatore,alloggio_short,alloggio"
    )
    .is("deleted_at", null)
    .eq("preferenza_alloggio_operatore", "Hotel")
    .order("gruppo_label", { ascending: true })
    .order("cognome", { ascending: true })
    .order("nome", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as OperatorHotelRow[]).filter(
    (row) =>
      isOperatorRegistrationType(row.tipo_iscrizione) &&
      normalizeOperatorAccommodationPreference(row.preferenza_alloggio_operatore) ===
        "Hotel" &&
      !isAutonomousAccommodation(row.alloggio_short) &&
      !isAutonomousAccommodation(row.alloggio)
  );
  const file = buildWorkbook(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="operatori-hotel-${dateStamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
