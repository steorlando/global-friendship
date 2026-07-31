import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import {
  describeStaffAvailability,
  type StaffAvailabilityStatRow,
} from "@/lib/statistics/staff-availability";

export const runtime = "nodejs";

type ParticipantContactRow = {
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

type StaffExportRow = ParticipantContactRow & {
  availability: StaffAvailabilityStatRow;
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

function displayPersonalCode(value: string | null): string {
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

function buildWorkbook(rows: StaffExportRow[]): Buffer {
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

export async function GET() {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { data: availabilityData, error: availabilityError } = await auth.service
    .from("participant_staff_availability")
    .select(
      "participant_id,areas,band_role,band_instrument,social_media_tasks,social_media_other,updated_at",
    )
    .order("updated_at", { ascending: false });

  if (availabilityError) {
    return NextResponse.json({ error: availabilityError.message }, { status: 500 });
  }

  const availabilityRows = (availabilityData ?? []) as StaffAvailabilityStatRow[];
  const participantIds = availabilityRows.map((row) => row.participant_id);
  const participantBatches: string[][] = [];
  for (let start = 0; start < participantIds.length; start += 200) {
    participantBatches.push(participantIds.slice(start, start + 200));
  }
  const participantResults = await Promise.all(
    participantBatches.map((batchIds) =>
      auth.service
        .from("partecipanti")
        .select(
          "id,personal_code,email,telefono,nome,cognome,gruppo_label,gruppo_id,deleted_at",
        )
        .in("id", batchIds)
        .is("deleted_at", null),
    ),
  );
  const participants: ParticipantContactRow[] = [];
  for (const result of participantResults) {
    if (result.error) {
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }
    participants.push(...((result.data ?? []) as ParticipantContactRow[]));
  }

  const availabilityByParticipant = new Map(
    availabilityRows.map((row) => [row.participant_id, row]),
  );
  const rows = participants
    .map((participant) => ({
      ...participant,
      availability: availabilityByParticipant.get(participant.id),
    }))
    .filter((row): row is StaffExportRow => Boolean(row.availability))
    .sort((a, b) => {
      const groupCompare = (a.gruppo_label ?? a.gruppo_id ?? "").localeCompare(
        b.gruppo_label ?? b.gruppo_id ?? "",
        "it",
      );
      if (groupCompare !== 0) return groupCompare;
      const surnameCompare = (a.cognome ?? "").localeCompare(b.cognome ?? "", "it");
      if (surnameCompare !== 0) return surnameCompare;
      return (a.nome ?? "").localeCompare(b.nome ?? "", "it");
    });

  const file = buildWorkbook(rows);
  const dateStamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        `attachment; filename="disponibilita-staff-${dateStamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
