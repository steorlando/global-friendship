import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type EmailTemplateRow = {
  id: string;
  name: string;
  subject: string;
  html: string;
  updated_at: string;
};

function normalizeText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.trim();
}

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

  const { data: profile, error: profileError } = await supabase
    .from("profili")
    .select("ruolo")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    return {
      errorResponse: NextResponse.json({ error: profileError.message }, { status: 500 }),
    };
  }

  if (profile?.ruolo !== "manager" && profile?.ruolo !== "admin") {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { supabase, userId: user.id };
}

function toTemplateResponse(row: EmailTemplateRow) {
  return {
    id: row.id,
    name: row.name,
    subject: row.subject,
    html: row.html,
    updatedAt: row.updated_at,
  };
}

export async function GET() {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  const { data, error } = await auth.supabase
    .from("email_templates")
    .select("id,name,subject,html,updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    templates: ((data ?? []) as EmailTemplateRow[]).map(toTemplateResponse),
  });
}

export async function POST(req: Request) {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = normalizeText(body.name);
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!name) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  if (!html.trim()) {
    return NextResponse.json({ error: "Template body is required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("email_templates")
    .insert({
      name,
      subject,
      html,
      created_by: auth.userId,
      updated_by: auth.userId,
    })
    .select("id,name,subject,html,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: toTemplateResponse(data as EmailTemplateRow) });
}

export async function PATCH(req: Request) {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = normalizeText(body.id);
  const name = normalizeText(body.name);
  const subject = typeof body.subject === "string" ? body.subject : "";
  const html = typeof body.html === "string" ? body.html : "";

  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  if (!name) {
    return NextResponse.json({ error: "Template name is required" }, { status: 400 });
  }

  if (!html.trim()) {
    return NextResponse.json({ error: "Template body is required" }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from("email_templates")
    .update({
      name,
      subject,
      html,
      updated_by: auth.userId,
    })
    .eq("id", id)
    .select("id,name,subject,html,updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ template: toTemplateResponse(data as EmailTemplateRow) });
}

export async function DELETE(req: Request) {
  const auth = await requireManagerOrAdmin();
  if ("errorResponse" in auth) return auth.errorResponse;

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const id = normalizeText(body.id);
  if (!id) {
    return NextResponse.json({ error: "Template id is required" }, { status: 400 });
  }

  const { error } = await auth.supabase.from("email_templates").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
