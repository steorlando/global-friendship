import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAccommodationManagerContext } from "@/lib/alloggi/auth";
import {
  importAccommodationRooms,
  ROOM_GENDER_POLICIES,
  type RoomGenderPolicy,
} from "@/lib/alloggi/inventory";

const MAX_XLSX_BYTES = 5 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

function normalizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeRowKeys(row: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    normalized[key.trim().toLowerCase()] = value;
  }
  return normalized;
}

function parseGenderPolicy(value: FormDataEntryValue | null): RoomGenderPolicy | null {
  const normalized = normalizeText(value);
  if (!normalized) return "mixed";
  return ROOM_GENDER_POLICIES.includes(normalized as RoomGenderPolicy)
    ? (normalized as RoomGenderPolicy)
    : null;
}

export async function POST(req: Request) {
  const auth = await requireAccommodationManagerContext();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const formData = await req.formData();
    const hotelId = normalizeText(formData.get("hotelId"));
    const genderPolicy = parseGenderPolicy(formData.get("genderPolicy"));
    const file = formData.get("file");

    if (!hotelId) {
      return NextResponse.json({ error: "hotelId is required" }, { status: 400 });
    }

    if (!genderPolicy) {
      return NextResponse.json(
        { error: "genderPolicy must be one of male_only, female_only, mixed" },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (file.size > MAX_XLSX_BYTES) {
      return NextResponse.json(
        { error: "Excel file is too large (max 5 MB)" },
        { status: 400 }
      );
    }

    if (!/\.(xlsx|xls)$/i.test(file.name)) {
      return NextResponse.json(
        { error: "The uploaded file must be an .xlsx or .xls spreadsheet" },
        { status: 400 }
      );
    }

    const workbook = XLSX.read(await file.arrayBuffer(), {
      type: "array",
      cellDates: false,
      raw: false,
    });

    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return NextResponse.json(
        { error: "The Excel file does not contain any worksheets" },
        { status: 400 }
      );
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: "",
      raw: false,
    });

    if (rows.length === 0) {
      return NextResponse.json(
        { error: "The Excel file does not contain any room rows" },
        { status: 400 }
      );
    }

    if (rows.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `Too many rows in Excel file (max ${MAX_IMPORT_ROWS})` },
        { status: 400 }
      );
    }

    const importedRooms = await importAccommodationRooms(auth.service, {
      hotelId,
      genderPolicy,
      rows: rows.map(normalizeRowKeys),
    });

    return NextResponse.json({
      ok: true,
      importedCount: importedRooms.length,
      rooms: importedRooms,
      actorRole: auth.profile.ruolo,
    });
  } catch (error) {
    const message = (error as Error).message;
    const status =
      message.includes("required") ||
      message.includes("must be") ||
      message.includes("does not contain") ||
      message.includes("Too many rows") ||
      message.includes("Hotel not found") ||
      message.startsWith("Row ")
        ? 400
        : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
