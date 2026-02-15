import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import { linkProfiloToGruppo, upsertProfiloByEmail } from "@/lib/admin/profili";
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

function parseBool(value: string): boolean | null {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (["true", "1", "yes", "y", "si", "sì"].includes(normalized)) return true;
  if (["false", "0", "no", "n"].includes(normalized)) return false;
  return null;
}

function normalizePhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/[\u200E\u200F\u202A-\u202E]/g, "");
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

    const groupedByEmail = new Map<
      string,
      {
        email: string;
        nome: string | null;
        cognome: string | null;
        telefono: string | null;
        italia: boolean | null;
        roma: boolean | null;
        ruolo: string;
        groups: Set<string>;
      }
    >();

    for (const row of rows) {
      const email = pickField(row, ["Email", "email", "e-mail"]).toLowerCase();
      if (!email) continue;

      const nome = pickField(row, ["Nome", "nome", "Name"]) || null;
      const cognome = pickField(row, ["Cognome", "cognome", "Surname"]) || null;
      const telefono = normalizePhone(pickField(row, ["telefono", "Telefono"]));
      const italia = parseBool(pickField(row, ["italia", "Italia"]));
      const roma = parseBool(pickField(row, ["roma", "Roma"]));
      const ruolo = pickField(row, ["ruolo", "Ruolo"]) || defaultRole;
      const groupName =
        pickField(row, ["group_name", "group", "gruppo", "Gruppo"]) || "";

      const existing = groupedByEmail.get(email);
      if (!existing) {
        groupedByEmail.set(email, {
          email,
          nome,
          cognome,
          telefono,
          italia,
          roma,
          ruolo,
          groups: groupName ? new Set([groupName]) : new Set(),
        });
        continue;
      }

      if (!existing.nome && nome) existing.nome = nome;
      if (!existing.cognome && cognome) existing.cognome = cognome;
      if (!existing.telefono && telefono) existing.telefono = telefono;
      if (existing.italia === null && italia !== null) existing.italia = italia;
      if (existing.roma === null && roma !== null) existing.roma = roma;
      if (!existing.ruolo && ruolo) existing.ruolo = ruolo;
      if (groupName) existing.groups.add(groupName);
    }

    let imported = 0;
    let skipped = 0;
    let groupLinks = 0;
    const errors: string[] = [];

    for (const [, row] of groupedByEmail) {
      try {
        const profilo = await upsertProfiloByEmail(supabase, {
          email: row.email,
          nome: row.nome,
          cognome: row.cognome,
          ruolo: row.ruolo,
          telefono: row.telefono,
          italia: row.italia,
          roma: row.roma,
        });

        for (const groupName of row.groups) {
          await linkProfiloToGruppo(supabase, profilo.id, groupName);
          groupLinks += 1;
        }
        imported += 1;
      } catch (error) {
        errors.push(`${row.email}: ${(error as Error).message}`);
      }
    }

    skipped = rows.length - groupedByEmail.size;

    return NextResponse.json({
      imported,
      skipped,
      groupLinks,
      errors,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
