import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { upsertProfiloByEmail } from "@/lib/admin/profili";
import { isAppRole } from "@/lib/auth/roles";
import { parseCsvObjects } from "@/lib/csv/parse";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

function pickField(row: Record<string, string>, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value.trim() !== "") {
      return value.trim();
    }
  }
  return "";
}

export async function POST(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const defaultRole = String(formData.get("defaultRole") || "capogruppo");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    if (!isAppRole(defaultRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const text = await file.text();
    const rows = parseCsvObjects(text, ";");
    const supabase = createSupabaseServiceClient();

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const row of rows) {
      const email = pickField(row, ["Email", "email", "e-mail"]);
      const nome = pickField(row, ["Nome", "nome", "Name"]);
      const cognome = pickField(row, ["Cognome", "cognome", "Surname"]);
      const ruolo = pickField(row, ["ruolo", "Ruolo"]) || defaultRole;

      if (!email) {
        skipped += 1;
        continue;
      }

      try {
        await upsertProfiloByEmail(supabase, {
          email,
          nome: nome || null,
          cognome: cognome || null,
          ruolo,
        });
        imported += 1;
      } catch (error) {
        errors.push(`${email}: ${(error as Error).message}`);
      }
    }

    return NextResponse.json({
      imported,
      skipped,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
