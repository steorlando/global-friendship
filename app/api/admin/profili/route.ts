import { NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/admin/auth";
import {
  listProfili,
  updateProfiloById,
  upsertProfiloByEmail,
} from "@/lib/admin/profili";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export async function GET() {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const supabase = createSupabaseServiceClient();
    const data = await listProfili(supabase);
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const groups = Array.isArray(body.groups)
      ? body.groups.map((group: unknown) => String(group).trim()).filter(Boolean)
      : [];
    if (groups.length === 0) {
      return NextResponse.json(
        { error: "At least one group is required" },
        { status: 400 }
      );
    }

    const supabase = createSupabaseServiceClient();
    const data = await upsertProfiloByEmail(supabase, {
      email: String(body.email ?? ""),
      nome: body.nome ? String(body.nome) : null,
      cognome: body.cognome ? String(body.cognome) : null,
      ruolo: String(body.ruolo ?? ""),
      telefono: body.telefono !== undefined ? String(body.telefono) : null,
      italia: body.italia !== undefined ? Boolean(body.italia) : null,
      roma: body.roma !== undefined ? Boolean(body.roma) : null,
      groups,
    });
    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}

export async function PATCH(req: Request) {
  const auth = await requireAdminUser();
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await req.json();
    const id = String(body.id ?? "");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const supabase = createSupabaseServiceClient();
    const groups =
      body.groups === undefined
        ? undefined
        : Array.isArray(body.groups)
          ? body.groups.map((group: unknown) => String(group))
          : [];
    const data = await updateProfiloById(supabase, id, {
      nome: body.nome !== undefined ? String(body.nome) : undefined,
      cognome: body.cognome !== undefined ? String(body.cognome) : undefined,
      ruolo: body.ruolo !== undefined ? String(body.ruolo) : undefined,
      telefono: body.telefono !== undefined ? String(body.telefono) : undefined,
      italia: body.italia !== undefined ? Boolean(body.italia) : undefined,
      roma: body.roma !== undefined ? Boolean(body.roma) : undefined,
      groups,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
