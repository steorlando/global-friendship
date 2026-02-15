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
    const supabase = createSupabaseServiceClient();
    const data = await upsertProfiloByEmail(supabase, {
      email: String(body.email ?? ""),
      nome: body.nome ? String(body.nome) : null,
      cognome: body.cognome ? String(body.cognome) : null,
      ruolo: String(body.ruolo ?? ""),
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
    const data = await updateProfiloById(supabase, id, {
      nome: body.nome !== undefined ? String(body.nome) : undefined,
      cognome: body.cognome !== undefined ? String(body.cognome) : undefined,
      ruolo: body.ruolo !== undefined ? String(body.ruolo) : undefined,
    });

    return NextResponse.json({ data });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 400 }
    );
  }
}
